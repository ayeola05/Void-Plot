import {
  FARM_POWER_DEMAND,
  FOREST_POWER_DEMAND,
  POWER_ALLOCATION_PRIORITY,
  POWER_PLANT_MATERIAL_COST,
  POWER_PLANT_OUTPUT,
} from "../data";
import { countRevealedTiles, createWorld } from "../world";
import {
  getBuildingDefinition,
  placeBuilding,
  validateBuildingState,
  type BuildingId,
  type BuildingRecord,
  type BuildingState,
  type PowerPlantBuildingRecord,
} from "./buildings";
import { createExpeditionState } from "./expedition";
import { createPopulationState, type PopulationState } from "./population";
import { recruitWorker } from "./recruitment";
import {
  assignWorkers,
  releaseWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";

export type PowerConsumerType = "farm" | "forest" | "lab";
export type PowerAllocationStatus = "powered" | "unpowered";

export interface PowerConsumerAllocation {
  readonly buildingId: BuildingId;
  readonly buildingType: PowerConsumerType;
  readonly demand: number;
  readonly priority: number;
  readonly status: PowerAllocationStatus;
}

export interface PowerAllocationSnapshot {
  readonly totalPowerGenerated: number;
  readonly totalPowerDemand: number;
  readonly totalPowerAllocated: number;
  readonly availablePower: number;
  readonly poweredBuildingIds: readonly BuildingId[];
  readonly unpoweredBuildingIds: readonly BuildingId[];
  readonly allocations: readonly PowerConsumerAllocation[];
}

export interface PowerAllocationModifiers {
  readonly powerPlantOutputAdjustment?: number;
  readonly staffedProductionDemandAddition?: number;
}

export type PowerAllocationResult =
  | {
      readonly status: "calculated";
      readonly snapshot: PowerAllocationSnapshot;
    }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-modifier" }
  | { readonly status: "numeric-overflow" };

export type PowerPlantAssignmentResult =
  | {
      readonly status: "assigned";
      readonly powerPlant: PowerPlantBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-power-plant" }
  | { readonly status: "already-assigned" }
  | { readonly status: "insufficient-workers" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" };

export type PowerPlantReleaseResult =
  | {
      readonly status: "released";
      readonly powerPlant: PowerPlantBuildingRecord;
      readonly buildingState: BuildingState;
      readonly workersState: WorkersState;
    }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-power-plant" }
  | { readonly status: "already-unassigned" }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-workers-state" };

export interface PowerFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly placementMaterialsBefore: number;
  readonly placementMaterialsAfter: number;
  readonly workersBeforeAssignment: WorkersState;
  readonly workersAfterAssignment: WorkersState;
  readonly workersAfterRelease: WorkersState;
  readonly belowDemandSnapshot?: PowerAllocationSnapshot;
  readonly equalDemandSnapshot?: PowerAllocationSnapshot;
  readonly shortageSnapshot?: PowerAllocationSnapshot;
  readonly failedOperationsWereAtomic: boolean;
}

export function createEmptyPowerSnapshot(): PowerAllocationSnapshot {
  return Object.freeze({
    totalPowerGenerated: 0,
    totalPowerDemand: 0,
    totalPowerAllocated: 0,
    availablePower: 0,
    poweredBuildingIds: Object.freeze([]),
    unpoweredBuildingIds: Object.freeze([]),
    allocations: Object.freeze([]),
  });
}

export function calculatePowerAllocation(
  buildingState: BuildingState,
  modifiers: PowerAllocationModifiers = {},
): PowerAllocationResult {
  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  const powerPlant = getBuildingDefinition("powerPlant");
  const outputAdjustment = modifiers.powerPlantOutputAdjustment ?? 0;
  const demandAddition = modifiers.staffedProductionDemandAddition ?? 0;
  if (!Number.isFinite(outputAdjustment) || !Number.isInteger(outputAdjustment)) {
    return { status: "invalid-modifier" };
  }
  if (!Number.isFinite(demandAddition) || !Number.isInteger(demandAddition) || demandAddition < 0) return { status: "invalid-modifier" };
  const outputPerPlant = Math.max(0, powerPlant.powerOutput + outputAdjustment);
  const staffedPlantCount = buildingState.buildings.filter(
    (building) =>
      building.type === "powerPlant" && building.assignedWorkers === 1,
  ).length;
  const totalPowerGenerated = staffedPlantCount * outputPerPlant;

  if (!Number.isSafeInteger(totalPowerGenerated)) {
    return { status: "numeric-overflow" };
  }

  const consumers = (["farm", "forest", "lab"] as const).flatMap((type) =>
    buildingState.buildings.filter(
      (building): building is Extract<BuildingRecord, { type: typeof type }> =>
        building.type === type && building.assignedWorkers === 1,
    ),
  );
  let remainingPower = totalPowerGenerated;
  let totalPowerDemand = 0;
  let totalPowerAllocated = 0;
  const poweredBuildingIds: BuildingId[] = [];
  const unpoweredBuildingIds: BuildingId[] = [];
  const allocations: PowerConsumerAllocation[] = [];

  for (const consumer of consumers) {
    const definition = getBuildingDefinition(consumer.type);
    const demand = definition.powerDemand + demandAddition;
    const priority = definition.powerAllocationPriority;

    if (
      !Number.isSafeInteger(demand) ||
      demand <= 0 ||
      priority === null ||
      !Number.isSafeInteger(priority)
    ) {
      return { status: "numeric-overflow" };
    }

    totalPowerDemand += demand;
    if (!Number.isSafeInteger(totalPowerDemand)) {
      return { status: "numeric-overflow" };
    }

    const powered = remainingPower >= demand;
    if (powered) {
      remainingPower -= demand;
      totalPowerAllocated += demand;
      poweredBuildingIds.push(consumer.id);
    } else {
      unpoweredBuildingIds.push(consumer.id);
    }

    allocations.push(
      Object.freeze({
        buildingId: consumer.id,
        buildingType: consumer.type,
        demand,
        priority,
        status: powered ? "powered" : "unpowered",
      }),
    );
  }

  return {
    status: "calculated",
    snapshot: Object.freeze({
      totalPowerGenerated,
      totalPowerDemand,
      totalPowerAllocated,
      availablePower: remainingPower,
      poweredBuildingIds: Object.freeze(poweredBuildingIds),
      unpoweredBuildingIds: Object.freeze(unpoweredBuildingIds),
      allocations: Object.freeze(allocations),
    }),
  };
}

export function isBuildingPowered(
  snapshot: PowerAllocationSnapshot,
  buildingId: BuildingId,
): boolean {
  return snapshot.poweredBuildingIds.includes(buildingId);
}

export function hasPowerShortage(snapshot: PowerAllocationSnapshot): boolean {
  return snapshot.totalPowerDemand > snapshot.totalPowerGenerated;
}

export function findPowerPlantById(
  buildingState: BuildingState,
  buildingId: BuildingId,
): PowerPlantBuildingRecord | undefined {
  const building = buildingState.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  return building?.type === "powerPlant" ? building : undefined;
}

export function assignWorkerToPowerPlant(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
): PowerPlantAssignmentResult {
  const validation = validatePowerPlantOperationInputs(
    buildingState,
    workersState,
    buildingId,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.powerPlant.assignedWorkers === 1) {
    return { status: "already-assigned" };
  }

  const nextWorkers = { ...workersState };
  const assignment = assignWorkers(nextWorkers, 1);
  if (assignment.status !== "assigned") {
    return assignment.status === "insufficient-workers"
      ? { status: "insufficient-workers" }
      : { status: "invalid-workers-state" };
  }

  const nextPowerPlant: PowerPlantBuildingRecord = Object.freeze({
    ...validation.powerPlant,
    assignedWorkers: 1,
  });
  return {
    status: "assigned",
    powerPlant: nextPowerPlant,
    buildingState: replacePowerPlant(buildingState, nextPowerPlant),
    workersState: nextWorkers,
  };
}

export function releaseWorkerFromPowerPlant(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
): PowerPlantReleaseResult {
  const validation = validatePowerPlantOperationInputs(
    buildingState,
    workersState,
    buildingId,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  if (validation.powerPlant.assignedWorkers === 0) {
    return { status: "already-unassigned" };
  }

  const nextWorkers = { ...workersState };
  const release = releaseWorkers(nextWorkers, 1);
  if (release.status !== "released") {
    return { status: "invalid-workers-state" };
  }

  const nextPowerPlant: PowerPlantBuildingRecord = Object.freeze({
    ...validation.powerPlant,
    assignedWorkers: 0,
  });
  return {
    status: "released",
    powerPlant: nextPowerPlant,
    buildingState: replacePowerPlant(buildingState, nextPowerPlant),
    workersState: nextWorkers,
  };
}

function validatePowerPlantOperationInputs(
  buildingState: BuildingState,
  workersState: WorkersState,
  buildingId: BuildingId,
):
  | { readonly status: "valid"; readonly powerPlant: PowerPlantBuildingRecord }
  | { readonly status: "building-not-found" }
  | { readonly status: "not-a-power-plant" }
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
  return building.type === "powerPlant"
    ? { status: "valid", powerPlant: building }
    : { status: "not-a-power-plant" };
}

function replacePowerPlant(
  buildingState: BuildingState,
  powerPlant: PowerPlantBuildingRecord,
): BuildingState {
  return Object.freeze({
    buildings: Object.freeze(
      buildingState.buildings.map((building) =>
        building.id === powerPlant.id ? powerPlant : building,
      ),
    ),
  });
}

export function validatePowerFoundation(): PowerFoundationValidationResult {
  const errors: string[] = [];
  const population = createPopulationState();
  if (population.status !== "created") {
    throw new Error("Power validation population fixture must be valid.");
  }

  const world = createWorld();
  const placementMaterials = { materials: 100 };
  const placementMaterialsBefore = placementMaterials.materials;
  const placement = placeBuilding(
    world,
    placementMaterials,
    Object.freeze({ buildings: Object.freeze([]) }),
    population.state,
    { x: 12, y: 12 },
    "powerPlant",
    () => "power-1",
  );
  const placementMaterialsAfter =
    placement.status === "placed" ? placement.materialsState.materials : 100;

  if (
    POWER_PLANT_MATERIAL_COST !== 60 ||
    POWER_PLANT_OUTPUT !== 4 ||
    FARM_POWER_DEMAND !== 1 ||
    FOREST_POWER_DEMAND !== 1 ||
    POWER_ALLOCATION_PRIORITY.farm >= POWER_ALLOCATION_PRIORITY.forest ||
    placement.status !== "placed" ||
    placementMaterialsAfter !== 40 ||
    placement.building.type !== "powerPlant" ||
    placement.building.assignedWorkers !== 0
  ) {
    errors.push("Central Power rules and unstaffed placement must be authoritative.");
  }

  const failedPlacementChecks = [
    validatePowerPlantPlacementFailure(
      { x: 0, y: 0 },
      100,
      "hidden-tile",
      population.state,
    ),
    validatePowerPlantPlacementFailure(
      { x: 13, y: 12 },
      59,
      "insufficient-materials",
      population.state,
    ),
  ];
  if (failedPlacementChecks.some((valid) => !valid)) {
    errors.push("Invalid Power Plant placements must fail atomically.");
  }

  if (placement.status !== "placed" || placement.building.type !== "powerPlant") {
    throw new Error("Power validation requires a placed Power Plant.");
  }

  const unstaffedPower = calculatePowerAllocation(placement.buildingState);
  if (
    unstaffedPower.status !== "calculated" ||
    unstaffedPower.snapshot.totalPowerGenerated !== 0
  ) {
    errors.push("An unstaffed Power Plant must generate zero Power.");
  }

  const workersBeforeAssignment = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const assignment = assignWorkerToPowerPlant(
    placement.buildingState,
    workersBeforeAssignment,
    "power-1",
  );
  const workersAfterAssignment =
    assignment.status === "assigned"
      ? { ...assignment.workersState }
      : { ...workersBeforeAssignment };
  const staffedPower =
    assignment.status === "assigned"
      ? calculatePowerAllocation(assignment.buildingState)
      : undefined;

  if (
    assignment.status !== "assigned" ||
    workersAfterAssignment.availableWorkers !== 0 ||
    staffedPower?.status !== "calculated" ||
    staffedPower.snapshot.totalPowerGenerated !== 4
  ) {
    errors.push("Staffing a Power Plant must reserve one worker and generate four Power.");
  }

  const release =
    assignment.status === "assigned"
      ? releaseWorkerFromPowerPlant(
          assignment.buildingState,
          assignment.workersState,
          "power-1",
        )
      : undefined;
  const workersAfterRelease =
    release?.status === "released"
      ? { ...release.workersState }
      : { ...workersAfterAssignment };
  const releasedPower =
    release?.status === "released"
      ? calculatePowerAllocation(release.buildingState)
      : undefined;
  if (
    release?.status !== "released" ||
    workersAfterRelease.availableWorkers !== 1 ||
    releasedPower?.status !== "calculated" ||
    releasedPower.snapshot.totalPowerGenerated !== 0
  ) {
    errors.push("Releasing a Power Plant worker must restore the shared worker.");
  }

  const belowDemand = calculatePowerAllocation(
    createAllocationFixture(1, ["farm-1", "farm-2"], ["forest-1"]),
  );
  const equalDemand = calculatePowerAllocation(
    createAllocationFixture(
      1,
      ["farm-1", "farm-2"],
      ["forest-1", "forest-2"],
    ),
  );
  const shortage = calculatePowerAllocation(
    createAllocationFixture(
      1,
      ["farm-2", "farm-1", "farm-3"],
      ["forest-2", "forest-1"],
    ),
  );
  const noPower = calculatePowerAllocation(
    createAllocationFixture(0, ["farm-1"], ["forest-1"]),
  );
  const belowDemandSnapshot =
    belowDemand.status === "calculated" ? belowDemand.snapshot : undefined;
  const equalDemandSnapshot =
    equalDemand.status === "calculated" ? equalDemand.snapshot : undefined;
  const shortageSnapshot =
    shortage.status === "calculated" ? shortage.snapshot : undefined;

  if (
    belowDemandSnapshot?.totalPowerGenerated !== 4 ||
    belowDemandSnapshot.totalPowerDemand !== 3 ||
    belowDemandSnapshot.totalPowerAllocated !== 3 ||
    belowDemandSnapshot.availablePower !== 1 ||
    belowDemandSnapshot.unpoweredBuildingIds.length !== 0
  ) {
    errors.push("Demand below generation must power every consumer.");
  }

  if (
    equalDemandSnapshot?.totalPowerDemand !== 4 ||
    equalDemandSnapshot.totalPowerAllocated !== 4 ||
    equalDemandSnapshot.availablePower !== 0
  ) {
    errors.push("Demand equal to generation must allocate all Power exactly.");
  }

  if (
    shortageSnapshot?.totalPowerDemand !== 5 ||
    shortageSnapshot.totalPowerAllocated !== 4 ||
    JSON.stringify(shortageSnapshot.poweredBuildingIds) !==
      JSON.stringify(["farm-2", "farm-1", "farm-3", "forest-2"]) ||
    JSON.stringify(shortageSnapshot.unpoweredBuildingIds) !==
      JSON.stringify(["forest-1"]) ||
    !hasPowerShortage(shortageSnapshot)
  ) {
    errors.push("Shortage allocation must honor type priority and creation order.");
  }

  if (
    noPower.status !== "calculated" ||
    noPower.snapshot.totalPowerGenerated !== 0 ||
    noPower.snapshot.poweredBuildingIds.length !== 0 ||
    noPower.snapshot.unpoweredBuildingIds.length !== 2
  ) {
    errors.push("No staffed Power Plant must leave every consumer unpowered.");
  }

  const recruited = recruitWorker(
    createPopulationFixture(5, 6),
    { totalWorkers: 4, availableWorkers: 0, assignedWorkers: 4 },
    { food: 10 },
  );
  const recruitedAssignment =
    recruited.status === "recruited"
      ? assignWorkerToPowerPlant(
          placement.buildingState,
          recruited.workersState,
          "power-1",
        )
      : undefined;
  if (recruitedAssignment?.status !== "assigned") {
    errors.push("A recruited worker must be assignable to a Power Plant.");
  }

  const exhaustedWorkers = {
    totalWorkers: 4,
    availableWorkers: 0,
    assignedWorkers: 4,
  };
  const failedBefore = JSON.stringify({
    buildings: placement.buildingState,
    exhaustedWorkers,
  });
  const failedAssignment = assignWorkerToPowerPlant(
    placement.buildingState,
    exhaustedWorkers,
    "power-1",
  );
  const failedAfter = JSON.stringify({
    buildings: placement.buildingState,
    exhaustedWorkers,
  });
  const failedReleaseBefore = JSON.stringify({
    buildings: placement.buildingState,
    workersBeforeAssignment,
  });
  const failedRelease = releaseWorkerFromPowerPlant(
    placement.buildingState,
    workersBeforeAssignment,
    "power-1",
  );
  const failedReleaseAfter = JSON.stringify({
    buildings: placement.buildingState,
    workersBeforeAssignment,
  });

  const isolationWorld = createWorld();
  const isolationMaterials = { materials: 100 };
  const isolationFood = { food: 10 };
  const isolationPopulation = createPopulationFixture(5, 6);
  const isolationExpedition = createExpeditionState();
  const isolationBefore = JSON.stringify({
    isolationMaterials,
    isolationFood,
    isolationPopulation,
    reveal: countRevealedTiles(isolationWorld),
    isolationExpedition,
  });
  calculatePowerAllocation(createAllocationFixture(1, ["farm-1"], ["forest-1"]));
  const isolationAfter = JSON.stringify({
    isolationMaterials,
    isolationFood,
    isolationPopulation,
    reveal: countRevealedTiles(isolationWorld),
    isolationExpedition,
  });
  const failedOperationsWereAtomic =
    failedPlacementChecks.every(Boolean) &&
    failedAssignment.status === "insufficient-workers" &&
    failedBefore === failedAfter &&
    failedRelease.status === "already-unassigned" &&
    failedReleaseBefore === failedReleaseAfter &&
    isolationBefore === isolationAfter;

  if (!failedOperationsWereAtomic) {
    errors.push("Failed staffing and allocation must not mutate supplied states.");
  }

  return {
    valid: errors.length === 0,
    errors,
    placementMaterialsBefore,
    placementMaterialsAfter,
    workersBeforeAssignment: { ...workersBeforeAssignment },
    workersAfterAssignment,
    workersAfterRelease,
    belowDemandSnapshot,
    equalDemandSnapshot,
    shortageSnapshot,
    failedOperationsWereAtomic,
  };
}

function validatePowerPlantPlacementFailure(
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
    "powerPlant",
    () => "failed-power-plant",
  );
  const after = JSON.stringify({ world, materialsState, buildingState, population });
  return result.status === expectedStatus && before === after;
}

function createAllocationFixture(
  staffedPlantCount: number,
  farmIds: readonly string[],
  forestIds: readonly string[],
): BuildingState {
  const buildings: BuildingRecord[] = [];
  for (let index = 0; index < staffedPlantCount; index += 1) {
    buildings.push({
      id: `power-${index + 1}`,
      type: "powerPlant",
      status: "constructed",
      coordinate: { x: index, y: 0 },
      assignedWorkers: 1,
    });
  }
  farmIds.forEach((id, index) => {
    buildings.push({
      id,
      type: "farm",
      status: "constructed",
      coordinate: { x: index, y: 1 },
      assignedWorkers: 1,
      productionTiming: { accumulatedMilliseconds: 0 },
    });
  });
  forestIds.forEach((id, index) => {
    buildings.push({
      id,
      type: "forest",
      status: "constructed",
      coordinate: { x: index, y: 2 },
      assignedWorkers: 1,
      productionTiming: { accumulatedMilliseconds: 0 },
    });
  });
  return Object.freeze({ buildings: Object.freeze(buildings) });
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
