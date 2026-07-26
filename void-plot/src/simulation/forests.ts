import { countRevealedTiles, createWorld, occupyTile } from "../world";
import {
  findBuildingAt,
  getBuildingDefinition,
  placeBuilding,
  validateBuildingPlacement,
  validateBuildingState,
  type BuildingId,
  type BuildingState,
  type ForestBuildingRecord,
} from "./buildings";
import { createExpeditionState, getExpeditionRequirements } from "./expedition";
import {
  addMaterials,
  canAffordMaterials,
  validateMaterialsState,
  type MaterialsState,
} from "./materials";
import { createPopulationState, type PopulationState } from "./population";
import { recruitWorker } from "./recruitment";
import {
  isBuildingPowered,
  type PowerAllocationSnapshot,
} from "./power";
import {
  assignWorkers,
  canAssignWorkers,
  releaseWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";

const EMPTY_FOREST_EVENTS = Object.freeze([]) as readonly ForestProductionEvent[];

export interface ForestProductionProgress {
  readonly status: "unstaffed" | "producing" | "no-power";
  readonly active: boolean;
  readonly progress: number;
  readonly progressPercent: number;
  readonly remainingMilliseconds: number;
  readonly remainingSeconds: number;
}

export interface ForestProductionEvent {
  readonly forestId: BuildingId;
  readonly coordinate: ForestBuildingRecord["coordinate"];
  readonly materialsProduced: number;
  readonly completedIntervals: number;
  readonly newMaterialsBalance: number;
}

export interface ForestProductionModifiers {
  readonly bonusMaterialsPerInterval?: number;
  readonly productionRateMultiplier?: number;
}

export type ForestAssignmentResult =
  | {
      readonly status: "assigned";
      readonly forest: ForestBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-forest" }
  | { readonly status: "already-assigned" }
  | { readonly status: "insufficient-workers" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" };

export type ForestReleaseResult =
  | {
      readonly status: "released";
      readonly forest: ForestBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-forest" }
  | { readonly status: "already-unassigned" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" };

export type ForestProductionResult =
  | {
      readonly status: "advanced";
      readonly buildingState: BuildingState;
      readonly materialsState: MaterialsState;
      readonly materialsProduced: number;
      readonly producingForestCount: number;
      readonly productionEvents: readonly ForestProductionEvent[];
    }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-materials-state" }
  | { readonly status: "invalid-elapsed-time" }
  | { readonly status: "invalid-production-modifier" }
  | { readonly status: "materials-overflow" };

export interface ForestFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly placementMaterialsBefore: number;
  readonly placementMaterialsAfter: number;
  readonly workersBeforeAssignment: WorkersState;
  readonly workersAfterAssignment: WorkersState;
  readonly workersAfterRelease: WorkersState;
  readonly materialsBeforeProduction: number;
  readonly materialsAfterProduction: number;
  readonly delayedMaterialsProduced: number;
  readonly failedOperationsWereAtomic: boolean;
}

export function findForestById(
  state: BuildingState,
  buildingId: BuildingId,
): ForestBuildingRecord | undefined {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  return building?.type === "forest" ? building : undefined;
}

export function getForestProductionProgress(
  forest: ForestBuildingRecord,
  powered = true,
  productionRateMultiplier = 1,
): ForestProductionProgress {
  const intervalMilliseconds =
    (getBuildingDefinition("forest").productionIntervalSeconds * 1_000) /
    (Number.isFinite(productionRateMultiplier) && productionRateMultiplier > 0
      ? productionRateMultiplier
      : 1);
  const accumulated = Math.min(
    intervalMilliseconds,
    Math.max(0, forest.productionTiming.accumulatedMilliseconds),
  );
  const progress = accumulated / intervalMilliseconds;
  const remainingMilliseconds = Math.max(0, intervalMilliseconds - accumulated);
  const staffed = forest.assignedWorkers === 1;
  const active = staffed && powered;

  return Object.freeze({
    status: active ? "producing" : staffed ? "no-power" : "unstaffed",
    active,
    progress,
    progressPercent: Math.round(progress * 100),
    remainingMilliseconds,
    remainingSeconds: remainingMilliseconds / 1_000,
  });
}

export function assignWorkerToForest(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
): ForestAssignmentResult {
  const validation = validateForestOperationInputs(
    buildingState,
    workersState,
    buildingId,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.forest.assignedWorkers === 1) {
    return { status: "already-assigned" };
  }

  const nextWorkers = { ...workersState };
  const assignment = assignWorkers(nextWorkers, 1);

  if (assignment.status !== "assigned") {
    return assignment.status === "insufficient-workers"
      ? { status: "insufficient-workers" }
      : { status: "invalid-workers-state" };
  }

  const forest: ForestBuildingRecord = Object.freeze({
    ...validation.forest,
    assignedWorkers: 1,
  });

  return {
    status: "assigned",
    forest,
    buildingState: replaceForest(buildingState, forest),
    workersState: nextWorkers,
  };
}

export function releaseWorkerFromForest(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
): ForestReleaseResult {
  const validation = validateForestOperationInputs(
    buildingState,
    workersState,
    buildingId,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.forest.assignedWorkers === 0) {
    return { status: "already-unassigned" };
  }

  const nextWorkers = { ...workersState };
  const release = releaseWorkers(nextWorkers, 1);

  if (release.status !== "released") {
    return { status: "invalid-workers-state" };
  }

  const forest: ForestBuildingRecord = Object.freeze({
    ...validation.forest,
    assignedWorkers: 0,
  });

  return {
    status: "released",
    forest,
    buildingState: replaceForest(buildingState, forest),
    workersState: nextWorkers,
  };
}

export function advanceForestProduction(
  buildingState: BuildingState,
  materialsState: MaterialsState,
  elapsedMilliseconds: number,
  powerSnapshot: PowerAllocationSnapshot,
  modifiers: ForestProductionModifiers = {},
): ForestProductionResult {
  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  if (!validateMaterialsState(materialsState).valid) {
    return { status: "invalid-materials-state" };
  }

  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return { status: "invalid-elapsed-time" };
  }

  const bonusMaterialsPerInterval = modifiers.bonusMaterialsPerInterval ?? 0;
  if (!Number.isFinite(bonusMaterialsPerInterval) || !Number.isInteger(bonusMaterialsPerInterval)) {
    return { status: "invalid-production-modifier" };
  }
  const productionRateMultiplier = modifiers.productionRateMultiplier ?? 1;
  if (!Number.isFinite(productionRateMultiplier) || productionRateMultiplier <= 0) {
    return { status: "invalid-production-modifier" };
  }

  const definition = getBuildingDefinition("forest");
  const intervalMilliseconds =
    (definition.productionIntervalSeconds * 1_000) / productionRateMultiplier;
  let materialsProduced = 0;
  let producingForestCount = 0;
  const pendingEvents: Array<
    Omit<ForestProductionEvent, "newMaterialsBalance">
  > = [];
  const nextBuildings = buildingState.buildings.map((building) => {
    if (
      building.type !== "forest" ||
      building.assignedWorkers === 0 ||
      !isBuildingPowered(powerSnapshot, building.id)
    ) {
      return building;
    }

    producingForestCount += 1;
    const accumulated =
      building.productionTiming.accumulatedMilliseconds + elapsedMilliseconds;

    if (!Number.isFinite(accumulated) || accumulated < 0) {
      materialsProduced = Number.POSITIVE_INFINITY;
      return building;
    }

    const completedIntervals = Math.floor(accumulated / intervalMilliseconds);
    const producedByForest =
      completedIntervals *
      Math.max(0, definition.materialsPerProductionInterval + bonusMaterialsPerInterval);

    if (!Number.isSafeInteger(producedByForest)) {
      materialsProduced = Number.POSITIVE_INFINITY;
      return building;
    }

    materialsProduced += producedByForest;

    if (producedByForest > 0) {
      pendingEvents.push({
        forestId: building.id,
        coordinate: Object.freeze({ ...building.coordinate }),
        materialsProduced: producedByForest,
        completedIntervals,
      });
    }

    return Object.freeze({
      ...building,
      productionTiming: Object.freeze({
        accumulatedMilliseconds:
          accumulated - completedIntervals * intervalMilliseconds,
      }),
    });
  });

  if (
    !Number.isSafeInteger(materialsProduced) ||
    !Number.isSafeInteger(materialsState.materials + materialsProduced)
  ) {
    return { status: "materials-overflow" };
  }

  const nextMaterialsState = { ...materialsState };

  if (
    materialsProduced > 0 &&
    addMaterials(nextMaterialsState, materialsProduced).status !== "added"
  ) {
    return { status: "materials-overflow" };
  }

  let runningBalance = materialsState.materials;
  const productionEvents = Object.freeze(
    pendingEvents.map((event): ForestProductionEvent => {
      runningBalance += event.materialsProduced;
      return Object.freeze({ ...event, newMaterialsBalance: runningBalance });
    }),
  );

  return {
    status: "advanced",
    buildingState:
      producingForestCount === 0
        ? buildingState
        : Object.freeze({ buildings: Object.freeze(nextBuildings) }),
    materialsState:
      materialsProduced === 0 ? materialsState : nextMaterialsState,
    materialsProduced,
    producingForestCount,
    productionEvents:
      productionEvents.length === 0 ? EMPTY_FOREST_EVENTS : productionEvents,
  };
}

function replaceForest(
  state: BuildingState,
  forest: ForestBuildingRecord,
): BuildingState {
  return Object.freeze({
    buildings: Object.freeze(
      state.buildings.map((building) =>
        building.id === forest.id ? forest : building,
      ),
    ),
  });
}

function validateForestOperationInputs(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
):
  | { readonly status: "valid"; readonly forest: ForestBuildingRecord }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-forest" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" } {
  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  if (!validateWorkersState(workersState).valid) {
    return { status: "invalid-workers-state" };
  }

  const building = buildingState.buildings.find(
    (candidate) => candidate.id === buildingId,
  );

  if (building === undefined) {
    return { status: "building-not-found" };
  }

  return building.type === "forest"
    ? { status: "valid", forest: building }
    : { status: "not-a-forest" };
}

export function validateForestFoundation(): ForestFoundationValidationResult {
  const errors: string[] = [];
  const population = createPopulationState();

  if (population.status !== "created") {
    throw new Error("Forest validation population fixture must be valid.");
  }

  const placementWorld = createWorld();
  const placementMaterials = { materials: 100 };
  const placementMaterialsBefore = placementMaterials.materials;
  const placement = placeBuilding(
    placementWorld,
    placementMaterials,
    Object.freeze({ buildings: Object.freeze([]) }),
    population.state,
    { x: 12, y: 12 },
    "forest",
    () => "forest-1",
  );
  const placementMaterialsAfter =
    placement.status === "placed"
      ? placement.materialsState.materials
      : placementMaterialsBefore;

  if (
    placement.status !== "placed" ||
    placementMaterialsAfter !== 60 ||
    placement.building.type !== "forest" ||
    placement.building.assignedWorkers !== 0 ||
    findBuildingAt(placement.buildingState, { x: 12, y: 12 })?.id !==
      "forest-1"
  ) {
    errors.push("Forest placement must spend 40 Materials and start unstaffed.");
  }

  const failedPlacementChecks = [
    validateForestPlacementFailure({ x: 0, y: 0 }, 100, "hidden-tile", population.state),
    validateForestPlacementFailure({ x: 13, y: 12 }, 39, "insufficient-materials", population.state),
    validateOccupiedForestPlacement(population.state),
  ];

  if (failedPlacementChecks.some((valid) => !valid)) {
    errors.push("Invalid Forest placements must fail atomically.");
  }

  if (placement.status !== "placed" || placement.building.type !== "forest") {
    throw new Error("Forest assignment validation requires a placed Forest.");
  }

  const workersBeforeAssignment = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const assignment = assignWorkerToForest(
    placement.buildingState,
    workersBeforeAssignment,
    placement.building.id,
  );
  const workersAfterAssignment =
    assignment.status === "assigned"
      ? { ...assignment.workersState }
      : { ...workersBeforeAssignment };

  if (
    assignment.status !== "assigned" ||
    assignment.forest.assignedWorkers !== 1 ||
    workersAfterAssignment.availableWorkers !== 0 ||
    canAssignWorkers(workersAfterAssignment, 1).status !==
      "insufficient-workers"
  ) {
    errors.push("Forest assignment must reserve one shared global worker.");
  }

  const exhaustedWorkers = {
    totalWorkers: 4,
    availableWorkers: 0,
    assignedWorkers: 4,
  };
  const failedAssignmentBefore = JSON.stringify({
    buildings: placement.buildingState,
    workers: exhaustedWorkers,
  });
  const failedAssignment = assignWorkerToForest(
    placement.buildingState,
    exhaustedWorkers,
    placement.building.id,
  );
  const failedAssignmentAfter = JSON.stringify({
    buildings: placement.buildingState,
    workers: exhaustedWorkers,
  });

  if (
    failedAssignment.status !== "insufficient-workers" ||
    failedAssignmentBefore !== failedAssignmentAfter
  ) {
    errors.push("Insufficient Forest assignment must preserve both states.");
  }

  const beforeInterval =
    assignment.status === "assigned"
      ? advanceForestProduction(
          assignment.buildingState,
          { materials: 60 },
          9_999,
          createForestValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const atInterval =
    assignment.status === "assigned"
      ? advanceForestProduction(
          assignment.buildingState,
          { materials: 60 },
          10_000,
          createForestValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const materialsBeforeProduction = 60;
  const materialsAfterProduction =
    atInterval?.status === "advanced"
      ? atInterval.materialsState.materials
      : materialsBeforeProduction;

  if (
    beforeInterval?.status !== "advanced" ||
    beforeInterval.materialsProduced !== 0 ||
    atInterval?.status !== "advanced" ||
    atInterval.materialsProduced !== 5 ||
    materialsAfterProduction !== 65 ||
    atInterval.productionEvents[0]?.forestId !== "forest-1" ||
    atInterval.productionEvents[0]?.completedIntervals !== 1
  ) {
    errors.push("A staffed Forest must emit the correct event after 10 seconds.");
  }

  const fractionalBefore =
    assignment.status === "assigned"
      ? advanceForestProduction(
          assignment.buildingState,
          { materials: 0 },
          9_999.5,
          createForestValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const fractionalCompletion =
    fractionalBefore?.status === "advanced"
      ? advanceForestProduction(
          fractionalBefore.buildingState,
          fractionalBefore.materialsState,
          0.5,
          createForestValidationPowerSnapshot(fractionalBefore.buildingState),
        )
      : undefined;

  if (
    fractionalBefore?.status !== "advanced" ||
    fractionalBefore.materialsProduced !== 0 ||
    fractionalCompletion?.status !== "advanced" ||
    fractionalCompletion.materialsProduced !== 5
  ) {
    errors.push("Finite fractional frame deltas must accumulate safely.");
  }

  const delayed =
    assignment.status === "assigned"
      ? advanceForestProduction(
          assignment.buildingState,
          { materials: 60 },
          30_000,
          createForestValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const delayedMaterialsProduced =
    delayed?.status === "advanced" ? delayed.materialsProduced : 0;

  if (
    delayed?.status !== "advanced" ||
    delayedMaterialsProduced !== 15 ||
    delayed.productionEvents[0]?.completedIntervals !== 3 ||
    delayed.productionEvents[0]?.materialsProduced !== 15
  ) {
    errors.push("Delayed Forest production must process every completed interval.");
  }

  const secondForest = createValidationForest("forest-2", 13);
  const staffedFirstForest: ForestBuildingRecord =
    assignment.status === "assigned"
      ? assignment.forest
      : { ...createValidationForest("forest-1", 12), assignedWorkers: 1 };
  const twoForests: BuildingState = Object.freeze({
    buildings: Object.freeze([
      { ...staffedFirstForest, productionTiming: { accumulatedMilliseconds: 0 } },
      { ...secondForest, assignedWorkers: 1 as const },
    ]),
  });
  const multiple = advanceForestProduction(
    twoForests,
    { materials: 0 },
    10_000,
    createForestValidationPowerSnapshot(twoForests),
  );

  if (
    multiple.status !== "advanced" ||
    multiple.materialsProduced !== 10 ||
    multiple.productionEvents.length !== 2 ||
    multiple.productionEvents[0]?.forestId !== "forest-1" ||
    multiple.productionEvents[1]?.forestId !== "forest-2"
  ) {
    errors.push("Multiple Forests must produce independently associated events.");
  }

  const unstaffedState: BuildingState = Object.freeze({
    buildings: Object.freeze([createValidationForest("unstaffed", 14)]),
  });
  const unstaffed = advanceForestProduction(
    unstaffedState,
    { materials: 0 },
    50_000,
    createForestValidationPowerSnapshot(unstaffedState),
  );

  if (
    unstaffed.status !== "advanced" ||
    unstaffed.materialsProduced !== 0 ||
    findForestById(unstaffed.buildingState, "unstaffed")?.productionTiming
      .accumulatedMilliseconds !== 0
  ) {
    errors.push("Unstaffed Forests must produce nothing and preserve progress.");
  }

  const halfway =
    assignment.status === "assigned"
      ? advanceForestProduction(
          assignment.buildingState,
          { materials: 0 },
          5_000,
          createForestValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const unpoweredAdvance =
    halfway?.status === "advanced"
      ? advanceForestProduction(
          halfway.buildingState,
          halfway.materialsState,
          50_000,
          createForestValidationPowerSnapshot(halfway.buildingState, []),
        )
      : undefined;
  const unpoweredForest =
    unpoweredAdvance?.status === "advanced"
      ? findForestById(unpoweredAdvance.buildingState, "forest-1")
      : undefined;
  const repoweredAdvance =
    unpoweredAdvance?.status === "advanced"
      ? advanceForestProduction(
          unpoweredAdvance.buildingState,
          unpoweredAdvance.materialsState,
          5_000,
          createForestValidationPowerSnapshot(unpoweredAdvance.buildingState),
        )
      : undefined;

  if (
    unpoweredAdvance?.status !== "advanced" ||
    unpoweredAdvance.materialsProduced !== 0 ||
    unpoweredForest?.productionTiming.accumulatedMilliseconds !== 5_000 ||
    (unpoweredForest !== undefined &&
      getForestProductionProgress(unpoweredForest, false).status !== "no-power") ||
    repoweredAdvance?.status !== "advanced" ||
    repoweredAdvance.materialsProduced !== 5
  ) {
    errors.push("Forest progress must pause without Power and resume when repowered.");
  }
  const paused =
    halfway?.status === "advanced" && assignment.status === "assigned"
      ? releaseWorkerFromForest(
          halfway.buildingState,
          assignment.workersState,
          "forest-1",
        )
      : undefined;
  const pausedAdvance =
    paused?.status === "released"
      ? advanceForestProduction(
          paused.buildingState,
          { materials: 0 },
          50_000,
          createForestValidationPowerSnapshot(paused.buildingState),
        )
      : undefined;
  const resumed =
    pausedAdvance?.status === "advanced" && paused?.status === "released"
      ? assignWorkerToForest(
          pausedAdvance.buildingState,
          paused.workersState,
          "forest-1",
        )
      : undefined;
  const completedAfterResume =
    resumed?.status === "assigned"
      ? advanceForestProduction(
          resumed.buildingState,
          { materials: 0 },
          5_000,
          createForestValidationPowerSnapshot(resumed.buildingState),
        )
      : undefined;

  if (
    pausedAdvance?.status !== "advanced" ||
    findForestById(pausedAdvance.buildingState, "forest-1")?.productionTiming
      .accumulatedMilliseconds !== 5_000 ||
    completedAfterResume?.status !== "advanced" ||
    completedAfterResume.materialsProduced !== 5
  ) {
    errors.push("Forest production progress must pause and resume unchanged.");
  }

  const release =
    assignment.status === "assigned"
      ? releaseWorkerFromForest(
          assignment.buildingState,
          assignment.workersState,
          "forest-1",
        )
      : undefined;
  const workersAfterRelease =
    release?.status === "released"
      ? { ...release.workersState }
      : { ...workersAfterAssignment };

  if (
    release?.status !== "released" ||
    workersAfterRelease.availableWorkers !== 1 ||
    workersAfterRelease.assignedWorkers !== 3
  ) {
    errors.push("Forest release must atomically return its shared worker.");
  }

  const failedReleaseBefore = JSON.stringify({
    buildings: placement.buildingState,
    workers: workersBeforeAssignment,
  });
  const failedRelease = releaseWorkerFromForest(
    placement.buildingState,
    workersBeforeAssignment,
    "forest-1",
  );
  const failedReleaseAfter = JSON.stringify({
    buildings: placement.buildingState,
    workers: workersBeforeAssignment,
  });

  if (
    failedRelease.status !== "already-unassigned" ||
    failedReleaseBefore !== failedReleaseAfter
  ) {
    errors.push("Failed Forest release must preserve building and worker states.");
  }

  const recruited = recruitWorker(
    createPopulationFixture(5, 6),
    { totalWorkers: 4, availableWorkers: 0, assignedWorkers: 4 },
    { food: 10 },
  );
  const recruitedAssignment =
    recruited.status === "recruited"
      ? assignWorkerToForest(
          placement.buildingState,
          recruited.workersState,
          "forest-1",
        )
      : undefined;

  if (recruitedAssignment?.status !== "assigned") {
    errors.push("A recruited worker must be immediately assignable to a Forest.");
  }

  if (
    atInterval?.status !== "advanced" ||
    canAffordMaterials(atInterval.materialsState, 25).status !== "affordable" ||
    canAffordMaterials(atInterval.materialsState, 30).status !== "affordable" ||
    canAffordMaterials(atInterval.materialsState, 40).status !== "affordable" ||
    canAffordMaterials(
      atInterval.materialsState,
      getExpeditionRequirements(2).materialCost,
    ).status !== "affordable"
  ) {
    errors.push("Produced Materials must be immediately available to construction and expeditions.");
  }

  const overflowState = Object.freeze({
    buildings: Object.freeze([
      { ...createValidationForest("overflow", 15), assignedWorkers: 1 as const },
    ]),
  });
  const overflowMaterials = { materials: Number.MAX_SAFE_INTEGER - 2 };
  const overflowBefore = JSON.stringify({ overflowState, overflowMaterials });
  const overflow = advanceForestProduction(
    overflowState,
    overflowMaterials,
    10_000,
    createForestValidationPowerSnapshot(overflowState),
  );
  const overflowAfter = JSON.stringify({ overflowState, overflowMaterials });

  const validProductionBuildings =
    assignment.status === "assigned"
      ? assignment.buildingState
      : placement.buildingState;
  const invalidProductionMaterials = { materials: -1 };
  const invalidProductionBefore = JSON.stringify({
    validProductionBuildings,
    invalidProductionMaterials,
  });
  const invalidElapsed = advanceForestProduction(
    validProductionBuildings,
    { materials: 0 },
    NaN,
    createForestValidationPowerSnapshot(validProductionBuildings),
  );
  const invalidMaterials = advanceForestProduction(
    validProductionBuildings,
    invalidProductionMaterials,
    10_000,
    createForestValidationPowerSnapshot(validProductionBuildings),
  );
  const invalidProductionAfter = JSON.stringify({
    validProductionBuildings,
    invalidProductionMaterials,
  });

  const isolationFood = { food: 10 };
  const isolationPopulation = createPopulationFixture(5, 6);
  const isolationWorld = createWorld();
  const isolationExpedition = createExpeditionState();
  const isolationBefore = JSON.stringify({
    isolationFood,
    isolationPopulation,
    reveal: countRevealedTiles(isolationWorld),
    isolationExpedition,
  });
  if (assignment.status === "assigned") {
    advanceForestProduction(
      assignment.buildingState,
      { materials: 0 },
      10_000,
      createForestValidationPowerSnapshot(assignment.buildingState),
    );
  }
  const isolationAfter = JSON.stringify({
    isolationFood,
    isolationPopulation,
    reveal: countRevealedTiles(isolationWorld),
    isolationExpedition,
  });
  const failedOperationsWereAtomic =
    failedPlacementChecks.every(Boolean) &&
    failedAssignmentBefore === failedAssignmentAfter &&
    failedReleaseBefore === failedReleaseAfter &&
    overflow.status === "materials-overflow" &&
    overflowBefore === overflowAfter &&
    invalidElapsed.status === "invalid-elapsed-time" &&
    invalidMaterials.status === "invalid-materials-state" &&
    invalidProductionBefore === invalidProductionAfter &&
    isolationBefore === isolationAfter;

  if (!failedOperationsWereAtomic) {
    errors.push("Failed Forest operations and production isolation must be atomic.");
  }

  return {
    valid: errors.length === 0,
    errors,
    placementMaterialsBefore,
    placementMaterialsAfter,
    workersBeforeAssignment: { ...workersBeforeAssignment },
    workersAfterAssignment,
    workersAfterRelease,
    materialsBeforeProduction,
    materialsAfterProduction,
    delayedMaterialsProduced,
    failedOperationsWereAtomic,
  };
}

function validateForestPlacementFailure(
  coordinate: { x: number; y: number },
  materials: number,
  expectedStatus: "hidden-tile" | "insufficient-materials",
  population: PopulationState,
): boolean {
  const world = createWorld();
  const materialsState = { materials };
  const buildingState: BuildingState = Object.freeze({
    buildings: Object.freeze([]),
  });
  const before = JSON.stringify({ world, materialsState, buildingState, population });
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    population,
    coordinate,
    "forest",
    () => "failed-forest",
  );
  const after = JSON.stringify({ world, materialsState, buildingState, population });
  return result.status === expectedStatus && before === after;
}

function validateOccupiedForestPlacement(population: PopulationState): boolean {
  const world = createWorld();
  occupyTile(world, 13, 12);
  const materialsState = { materials: 100 };
  const buildingState: BuildingState = Object.freeze({
    buildings: Object.freeze([]),
  });
  const before = JSON.stringify({ world, materialsState, buildingState, population });
  const result = validateBuildingPlacement(
    world,
    materialsState,
    buildingState,
    population,
    { x: 13, y: 12 },
    "forest",
  );
  const after = JSON.stringify({ world, materialsState, buildingState, population });
  return result.status === "occupied-tile" && before === after;
}

function createValidationForest(
  id: string,
  x: number,
): ForestBuildingRecord {
  return Object.freeze({
    id,
    type: "forest",
    status: "constructed",
    coordinate: Object.freeze({ x, y: 12 }),
    assignedWorkers: 0,
    productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }),
  });
}

function createForestValidationPowerSnapshot(
  buildingState: BuildingState,
  poweredIds = buildingState.buildings
    .filter(
      (building) => building.type === "forest" && building.assignedWorkers === 1,
    )
    .map((building) => building.id),
): PowerAllocationSnapshot {
  const staffedForestIds = buildingState.buildings
    .filter(
      (building) => building.type === "forest" && building.assignedWorkers === 1,
    )
    .map((building) => building.id);
  const powered = staffedForestIds.filter((id) => poweredIds.includes(id));
  const unpowered = staffedForestIds.filter((id) => !poweredIds.includes(id));

  return Object.freeze({
    totalPowerGenerated: powered.length,
    totalPowerDemand: staffedForestIds.length,
    totalPowerAllocated: powered.length,
    availablePower: 0,
    poweredBuildingIds: Object.freeze(powered),
    unpoweredBuildingIds: Object.freeze(unpowered),
    allocations: Object.freeze(
      staffedForestIds.map((buildingId) =>
        Object.freeze({
          buildingId,
          buildingType: "forest" as const,
          demand: 1,
          priority: 2,
          status: poweredIds.includes(buildingId)
            ? ("powered" as const)
            : ("unpowered" as const),
        }),
      ),
    ),
  });
}

function createPopulationFixture(
  currentPopulation: number,
  populationCapacity: number,
): PopulationState {
  return Object.freeze({
    currentPopulation,
    populationCapacity,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "supplied",
    totalSuppliedCycles: 1,
    totalUnsuppliedCycles: 0,
  });
}
