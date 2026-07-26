import { getBuildingDefinition, validateBuildingState } from "./buildings";
import type {
  BuildingId,
  BuildingState,
  FarmBuildingRecord,
  FarmProductionTiming,
} from "./buildings";
import { addFood, validateFoodState, type FoodState } from "./food";
import {
  assignWorkers,
  releaseWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";
import { countRevealedTiles, createWorld } from "../world";
import { createPopulationState } from "./population";
import { createExpeditionState } from "./expedition";
import {
  isBuildingPowered,
  type PowerAllocationSnapshot,
} from "./power";

const EMPTY_PRODUCTION_EVENTS = Object.freeze([]) as readonly FarmProductionEvent[];

export interface FarmProductionProgress {
  readonly status: "unstaffed" | "producing" | "no-power";
  readonly active: boolean;
  readonly progress: number;
  readonly progressPercent: number;
  readonly remainingMilliseconds: number;
  readonly remainingSeconds: number;
}

export interface FarmProductionEvent {
  readonly farmId: BuildingId;
  readonly coordinate: FarmBuildingRecord["coordinate"];
  readonly foodProduced: number;
  readonly newFoodBalance: number;
}

export interface FarmProductionModifiers {
  readonly productionRateMultiplier?: number;
}

export type FarmAssignmentResult =
  | {
      readonly status: "assigned";
      readonly farm: FarmBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-farm" }
  | { readonly status: "already-assigned" }
  | { readonly status: "insufficient-workers" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" }
  | { readonly status: "invalid-time" };

export type FarmReleaseResult =
  | {
      readonly status: "released";
      readonly farm: FarmBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-farm" }
  | { readonly status: "already-unassigned" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" }
  | { readonly status: "invalid-time" };

export type FarmProductionResult =
  | {
      readonly status: "advanced";
      readonly buildingState: BuildingState;
      readonly foodState: FoodState;
      readonly foodProduced: number;
      readonly producingFarmCount: number;
      readonly productionEvents: readonly FarmProductionEvent[];
    }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-food-state" }
  | { readonly status: "invalid-production-modifier" }
  | { readonly status: "invalid-time" };

export interface FarmFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly workersBeforeAssignment: WorkersState;
  readonly workersAfterAssignment: WorkersState;
  readonly workersAfterRelease: WorkersState;
  readonly foodBeforeInterval: number;
  readonly foodAfterInterval: number;
  readonly failedOperationsWereAtomic: boolean;
}

export function findFarmById(
  state: BuildingState,
  buildingId: BuildingId,
): FarmBuildingRecord | undefined {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  return building?.type === "farm" ? building : undefined;
}

export function getFarmProductionProgress(
  farm: FarmBuildingRecord,
  powered = true,
  productionRateMultiplier = 1,
): FarmProductionProgress {
  const safeMultiplier =
    Number.isFinite(productionRateMultiplier) && productionRateMultiplier > 0
      ? productionRateMultiplier
      : 1;
  const intervalMilliseconds =
    (getBuildingDefinition("farm").productionIntervalSeconds * 1_000) /
    safeMultiplier;
  const accumulated = Math.min(
    intervalMilliseconds,
    Math.max(0, farm.productionTiming.accumulatedMilliseconds),
  );
  const progress =
    intervalMilliseconds === 0 ? 0 : accumulated / intervalMilliseconds;
  const remainingMilliseconds = Math.max(
    0,
    intervalMilliseconds - accumulated,
  );
  const staffed = farm.assignedWorkers === 1;
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

export function assignWorkerToFarm(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
  currentTimeMilliseconds: number,
): FarmAssignmentResult {
  const validation = validateFarmOperationInputs(
    buildingState,
    workersState,
    buildingId,
    currentTimeMilliseconds,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.farm.assignedWorkers === 1) {
    return { status: "already-assigned" };
  }

  const nextWorkers = { ...workersState };
  const assignment = assignWorkers(nextWorkers, 1);

  if (assignment.status !== "assigned") {
    return assignment.status === "insufficient-workers"
      ? { status: "insufficient-workers" }
      : { status: "invalid-workers-state" };
  }

  const farm: FarmBuildingRecord = Object.freeze({
    ...validation.farm,
    assignedWorkers: 1,
    productionTiming: Object.freeze({
      ...validation.farm.productionTiming,
      lastUpdateMilliseconds: currentTimeMilliseconds,
    }),
  });
  const nextBuildingState = replaceFarm(buildingState, farm);

  return {
    status: "assigned",
    farm,
    buildingState: nextBuildingState,
    workersState: nextWorkers,
  };
}

export function releaseWorkerFromFarm(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
  currentTimeMilliseconds: number,
): FarmReleaseResult {
  const validation = validateFarmOperationInputs(
    buildingState,
    workersState,
    buildingId,
    currentTimeMilliseconds,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.farm.assignedWorkers === 0) {
    return { status: "already-unassigned" };
  }

  const nextWorkers = { ...workersState };
  const release = releaseWorkers(nextWorkers, 1);

  if (release.status !== "released") {
    return { status: "invalid-workers-state" };
  }

  const farm: FarmBuildingRecord = Object.freeze({
    ...validation.farm,
    assignedWorkers: 0,
    productionTiming: Object.freeze({
      ...validation.farm.productionTiming,
      lastUpdateMilliseconds: currentTimeMilliseconds,
    }),
  });

  return {
    status: "released",
    farm,
    buildingState: replaceFarm(buildingState, farm),
    workersState: nextWorkers,
  };
}

export function advanceFarmProduction(
  buildingState: BuildingState,
  foodState: FoodState,
  currentTimeMilliseconds: number,
  powerSnapshot: PowerAllocationSnapshot,
  modifiers: FarmProductionModifiers = {},
): FarmProductionResult {
  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  if (!validateFoodState(foodState).valid) {
    return { status: "invalid-food-state" };
  }

  if (!isValidTime(currentTimeMilliseconds)) {
    return { status: "invalid-time" };
  }

  const productionRateMultiplier = modifiers.productionRateMultiplier ?? 1;
  if (!Number.isFinite(productionRateMultiplier) || productionRateMultiplier <= 0) {
    return { status: "invalid-production-modifier" };
  }

  const hasStaffedFarm = buildingState.buildings.some(
    (building) => building.type === "farm" && building.assignedWorkers === 1,
  );

  if (!hasStaffedFarm) {
    return {
      status: "advanced",
      buildingState,
      foodState,
      foodProduced: 0,
      producingFarmCount: 0,
      productionEvents: EMPTY_PRODUCTION_EVENTS,
    };
  }

  const definition = getBuildingDefinition("farm");
  const intervalMilliseconds =
    (definition.productionIntervalSeconds * 1_000) / productionRateMultiplier;
  let foodProduced = 0;
  let producingFarmCount = 0;
  const pendingEvents: Array<
    Omit<FarmProductionEvent, "newFoodBalance">
  > = [];
  const nextBuildings = buildingState.buildings.map((building) => {
    if (building.type !== "farm") {
      return building;
    }

    const lastUpdate = building.productionTiming.lastUpdateMilliseconds;
    const elapsed =
      lastUpdate === undefined
        ? 0
        : Math.max(0, currentTimeMilliseconds - lastUpdate);
    const powered = isBuildingPowered(powerSnapshot, building.id);
    const accumulated =
      building.assignedWorkers === 1 && powered
        ? building.productionTiming.accumulatedMilliseconds + elapsed
        : building.productionTiming.accumulatedMilliseconds;
    const intervals = Math.floor(accumulated / intervalMilliseconds);

    if (building.assignedWorkers === 1 && powered) {
      producingFarmCount += 1;
      const producedByFarm =
        intervals * definition.foodPerProductionInterval;
      foodProduced += producedByFarm;

      if (producedByFarm > 0) {
        pendingEvents.push({
          farmId: building.id,
          coordinate: Object.freeze({ ...building.coordinate }),
          foodProduced: producedByFarm,
        });
      }
    }

    const timing: FarmProductionTiming = Object.freeze({
      accumulatedMilliseconds: accumulated - intervals * intervalMilliseconds,
      lastUpdateMilliseconds: currentTimeMilliseconds,
    });

    return Object.freeze({ ...building, productionTiming: timing });
  });
  const nextFoodState = { ...foodState };

  if (foodProduced > 0 && addFood(nextFoodState, foodProduced).status !== "added") {
    return { status: "invalid-food-state" };
  }

  let runningBalance = foodState.food;
  const productionEvents = Object.freeze(
    pendingEvents.map((event): FarmProductionEvent => {
      runningBalance += event.foodProduced;
      return Object.freeze({ ...event, newFoodBalance: runningBalance });
    }),
  );

  return {
    status: "advanced",
    buildingState: Object.freeze({ buildings: Object.freeze(nextBuildings) }),
    foodState: nextFoodState,
    foodProduced,
    producingFarmCount,
    productionEvents,
  };
}

export function validateFarmFoundation(): FarmFoundationValidationResult {
  const errors: string[] = [];
  const farmDefinition = getBuildingDefinition("farm");
  const farm = createValidationFarm("farm-1");
  const secondFarm = createValidationFarm("farm-2");
  const initialBuildings: BuildingState = Object.freeze({
    buildings: Object.freeze([farm, secondFarm]),
  });
  const workersBeforeAssignment = {
    totalWorkers: 4,
    availableWorkers: 4,
    assignedWorkers: 0,
  };

  if (
    farmDefinition.materialCost !== 30 ||
    farmDefinition.maxAssignedWorkers !== 1 ||
    farmDefinition.foodPerProductionInterval !== 1 ||
    farmDefinition.productionIntervalSeconds !== 5
  ) {
    errors.push("The centralized Farm definition is incorrect.");
  }

  const assignment = assignWorkerToFarm(
    initialBuildings,
    workersBeforeAssignment,
    farm.id,
    0,
  );
  const workersAfterAssignment =
    assignment.status === "assigned"
      ? { ...assignment.workersState }
      : { ...workersBeforeAssignment };

  if (
    assignment.status !== "assigned" ||
    assignment.farm.assignedWorkers !== 1 ||
    workersAfterAssignment.availableWorkers !== 3
  ) {
    errors.push("A Farm assignment must atomically reserve one global worker.");
  }

  const foodBeforeInterval = 0;
  const beforeInterval =
    assignment.status === "assigned"
      ? advanceFarmProduction(
          assignment.buildingState,
          { food: 0 },
          4_999,
          createFarmValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;

  if (beforeInterval?.status !== "advanced" || beforeInterval.foodProduced !== 0) {
    errors.push("A staffed Farm must not produce before five seconds.");
  }

  const atInterval =
    beforeInterval?.status === "advanced"
      ? advanceFarmProduction(
          beforeInterval.buildingState,
          beforeInterval.foodState,
          5_000,
          createFarmValidationPowerSnapshot(beforeInterval.buildingState),
        )
      : undefined;
  const foodAfterInterval =
    atInterval?.status === "advanced" ? atInterval.foodState.food : 0;

  if (atInterval?.status !== "advanced" || foodAfterInterval !== 1) {
    errors.push("A staffed Farm must produce one Food after five seconds.");
  }

  const catchUp =
    assignment.status === "assigned"
      ? advanceFarmProduction(
          assignment.buildingState,
          { food: 0 },
          15_000,
          createFarmValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;

  if (catchUp?.status !== "advanced" || catchUp.foodProduced !== 3) {
    errors.push("Farm production must catch up across multiple intervals.");
  }

  if (
    catchUp?.status !== "advanced" ||
    catchUp.productionEvents.length !== 1 ||
    catchUp.productionEvents[0].farmId !== farm.id ||
    catchUp.productionEvents[0].foodProduced !== 3 ||
    catchUp.productionEvents[0].newFoodBalance !== 3
  ) {
    errors.push("Delayed production must emit one correctly associated +N Food event.");
  }

  const staffedSecond =
    assignment.status === "assigned"
      ? assignWorkerToFarm(assignment.buildingState, assignment.workersState, secondFarm.id, 0)
      : undefined;
  const twoFarmProduction =
    staffedSecond?.status === "assigned"
      ? advanceFarmProduction(
          staffedSecond.buildingState,
          { food: 0 },
          5_000,
          createFarmValidationPowerSnapshot(staffedSecond.buildingState),
        )
      : undefined;

  if (twoFarmProduction?.status !== "advanced" || twoFarmProduction.foodProduced !== 2) {
    errors.push("Multiple staffed Farms must produce independently.");
  }

  const unstaffed = advanceFarmProduction(
    initialBuildings,
    { food: 0 },
    20_000,
    createFarmValidationPowerSnapshot(initialBuildings),
  );
  if (unstaffed.status !== "advanced" || unstaffed.foodProduced !== 0) {
    errors.push("Unstaffed Farms must not produce Food.");
  }

  if (getFarmProductionProgress(farm).active) {
    errors.push("An unstaffed Farm must not report active production progress.");
  }

  const halfway =
    assignment.status === "assigned"
      ? advanceFarmProduction(
          assignment.buildingState,
          { food: 0 },
          2_500,
          createFarmValidationPowerSnapshot(assignment.buildingState),
        )
      : undefined;
  const halfwayFarm =
    halfway?.status === "advanced"
      ? findFarmById(halfway.buildingState, farm.id)
      : undefined;

  if (
    halfwayFarm === undefined ||
    getFarmProductionProgress(halfwayFarm).progressPercent !== 50
  ) {
    errors.push("A staffed Farm must report progress from its stored timing state.");
  }

  const unpoweredAdvance =
    halfway?.status === "advanced"
      ? advanceFarmProduction(
          halfway.buildingState,
          halfway.foodState,
          10_000,
          createFarmValidationPowerSnapshot(halfway.buildingState, []),
        )
      : undefined;
  const unpoweredFarm =
    unpoweredAdvance?.status === "advanced"
      ? findFarmById(unpoweredAdvance.buildingState, farm.id)
      : undefined;
  const repoweredAdvance =
    unpoweredAdvance?.status === "advanced"
      ? advanceFarmProduction(
          unpoweredAdvance.buildingState,
          unpoweredAdvance.foodState,
          12_500,
          createFarmValidationPowerSnapshot(unpoweredAdvance.buildingState),
        )
      : undefined;

  if (
    unpoweredAdvance?.status !== "advanced" ||
    unpoweredAdvance.foodProduced !== 0 ||
    unpoweredFarm?.productionTiming.accumulatedMilliseconds !== 2_500 ||
    getFarmProductionProgress(unpoweredFarm, false).status !== "no-power" ||
    repoweredAdvance?.status !== "advanced" ||
    repoweredAdvance.foodProduced !== 1
  ) {
    errors.push("Farm progress must pause without Power and resume when repowered.");
  }

  const pausedRelease =
    halfway?.status === "advanced" && assignment.status === "assigned"
      ? releaseWorkerFromFarm(
          halfway.buildingState,
          assignment.workersState,
          farm.id,
          2_500,
        )
      : undefined;
  const pausedAdvance =
    pausedRelease?.status === "released"
      ? advanceFarmProduction(
          pausedRelease.buildingState,
          { food: 0 },
          10_000,
          createFarmValidationPowerSnapshot(pausedRelease.buildingState),
        )
      : undefined;
  const resumedAssignment =
    pausedAdvance?.status === "advanced" && pausedRelease?.status === "released"
      ? assignWorkerToFarm(
          pausedAdvance.buildingState,
          pausedRelease.workersState,
          farm.id,
          10_000,
        )
      : undefined;
  const resumedProduction =
    resumedAssignment?.status === "assigned"
      ? advanceFarmProduction(
          resumedAssignment.buildingState,
          { food: 0 },
          12_500,
          createFarmValidationPowerSnapshot(resumedAssignment.buildingState),
        )
      : undefined;

  if (
    resumedProduction?.status !== "advanced" ||
    resumedProduction.foodProduced !== 1
  ) {
    errors.push("Partial Farm progress must survive release and reassignment.");
  }

  const resetFarm =
    resumedProduction?.status === "advanced"
      ? findFarmById(resumedProduction.buildingState, farm.id)
      : undefined;

  if (
    resetFarm === undefined ||
    getFarmProductionProgress(resetFarm).progress !== 0
  ) {
    errors.push("Farm progress must reset after a completed production interval.");
  }

  const externallyAssignedWorkers = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const sharedPoolAssignment = assignWorkerToFarm(
    initialBuildings,
    externallyAssignedWorkers,
    farm.id,
    0,
  );

  if (
    sharedPoolAssignment.status !== "assigned" ||
    sharedPoolAssignment.workersState.availableWorkers !== 0 ||
    sharedPoolAssignment.workersState.assignedWorkers !== 4
  ) {
    errors.push("Farm assignment must respect workers already used by other systems.");
  }

  const release =
    assignment.status === "assigned"
      ? releaseWorkerFromFarm(assignment.buildingState, assignment.workersState, farm.id, 5_000)
      : undefined;
  const workersAfterRelease =
    release?.status === "released"
      ? { ...release.workersState }
      : { ...workersAfterAssignment };

  if (
    release?.status !== "released" ||
    release.farm.assignedWorkers !== 0 ||
    workersAfterRelease.availableWorkers !== 4
  ) {
    errors.push("A Farm release must atomically return one global worker.");
  }

  const exhaustedWorkers = { totalWorkers: 4, availableWorkers: 0, assignedWorkers: 4 };
  const buildingsSnapshot = JSON.stringify(initialBuildings);
  const workersSnapshot = JSON.stringify(exhaustedWorkers);
  const failedAssignment = assignWorkerToFarm(initialBuildings, exhaustedWorkers, farm.id, 0);
  const failedOperationsWereAtomic =
    failedAssignment.status === "insufficient-workers" &&
    JSON.stringify(initialBuildings) === buildingsSnapshot &&
    JSON.stringify(exhaustedWorkers) === workersSnapshot;

  if (!failedOperationsWereAtomic) {
    errors.push("Failed Farm assignment must preserve both input states.");
  }

  const unassignedReleaseSnapshot = JSON.stringify({ initialBuildings, workersBeforeAssignment });
  const failedRelease = releaseWorkerFromFarm(
    initialBuildings,
    workersBeforeAssignment,
    farm.id,
    0,
  );

  if (
    failedRelease.status !== "already-unassigned" ||
    JSON.stringify({ initialBuildings, workersBeforeAssignment }) !==
      unassignedReleaseSnapshot
  ) {
    errors.push("Failed Farm release must preserve both input states.");
  }

  const isolationWorld = createWorld();
  const isolationPopulation = createPopulationState();
  const isolationMaterials = { materials: 170 };
  const isolationExpeditions = createExpeditionState();
  const revealedBefore = countRevealedTiles(isolationWorld);
  const populationBefore = JSON.stringify(isolationPopulation);
  const materialsBefore = isolationMaterials.materials;
  const expeditionsBefore = JSON.stringify(isolationExpeditions);

  if (assignment.status === "assigned") {
    advanceFarmProduction(
      assignment.buildingState,
      { food: 0 },
      5_000,
      createFarmValidationPowerSnapshot(assignment.buildingState),
    );
  }

  if (
    countRevealedTiles(isolationWorld) !== revealedBefore ||
    JSON.stringify(isolationPopulation) !== populationBefore ||
    isolationMaterials.materials !== materialsBefore ||
    JSON.stringify(isolationExpeditions) !== expeditionsBefore
  ) {
    errors.push(
      "Farm production must not mutate world, population, materials, or expeditions.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    workersBeforeAssignment: { ...workersBeforeAssignment },
    workersAfterAssignment,
    workersAfterRelease,
    foodBeforeInterval,
    foodAfterInterval,
    failedOperationsWereAtomic,
  };
}

function replaceFarm(
  state: BuildingState,
  farm: FarmBuildingRecord,
): BuildingState {
  return Object.freeze({
    buildings: Object.freeze(
      state.buildings.map((building) =>
        building.id === farm.id ? farm : building,
      ),
    ),
  });
}

function validateFarmOperationInputs(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
  currentTimeMilliseconds: number,
):
  | { readonly status: "valid"; readonly farm: FarmBuildingRecord }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-farm" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" }
  | { readonly status: "invalid-time" } {
  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  if (!validateWorkersState(workersState).valid) {
    return { status: "invalid-workers-state" };
  }

  if (!isValidTime(currentTimeMilliseconds)) {
    return { status: "invalid-time" };
  }

  const building = buildingState.buildings.find((candidate) => candidate.id === buildingId);

  if (building === undefined) {
    return { status: "building-not-found" };
  }

  return building.type === "farm"
    ? { status: "valid", farm: building }
    : { status: "not-a-farm" };
}

function createValidationFarm(id: string): FarmBuildingRecord {
  return Object.freeze({
    id,
    type: "farm",
    status: "constructed",
    coordinate: Object.freeze({ x: id === "farm-1" ? 12 : 13, y: 12 }),
    assignedWorkers: 0,
    productionTiming: Object.freeze({ accumulatedMilliseconds: 0, lastUpdateMilliseconds: 0 }),
  });
}

function createFarmValidationPowerSnapshot(
  buildingState: BuildingState,
  poweredIds = buildingState.buildings
    .filter((building) => building.type === "farm" && building.assignedWorkers === 1)
    .map((building) => building.id),
): PowerAllocationSnapshot {
  const staffedFarmIds = buildingState.buildings
    .filter((building) => building.type === "farm" && building.assignedWorkers === 1)
    .map((building) => building.id);
  const powered = staffedFarmIds.filter((id) => poweredIds.includes(id));
  const unpowered = staffedFarmIds.filter((id) => !poweredIds.includes(id));

  return Object.freeze({
    totalPowerGenerated: powered.length,
    totalPowerDemand: staffedFarmIds.length,
    totalPowerAllocated: powered.length,
    availablePower: 0,
    poweredBuildingIds: Object.freeze(powered),
    unpoweredBuildingIds: Object.freeze(unpowered),
    allocations: Object.freeze(
      staffedFarmIds.map((buildingId) =>
        Object.freeze({
          buildingId,
          buildingType: "farm" as const,
          demand: 1,
          priority: 1,
          status: poweredIds.includes(buildingId)
            ? ("powered" as const)
            : ("unpowered" as const),
        }),
      ),
    ),
  });
}

function isValidTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
