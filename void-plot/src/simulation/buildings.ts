import { BUILDING_DEFINITIONS } from "../data";
import {
  canOccupyTile,
  countRevealedTiles,
  createWorld,
  getTile,
  occupyTile,
  type TileCoordinate,
  type WorldState,
} from "../world";
import {
  canAffordMaterials,
  spendMaterials,
  validateMaterialsState,
  type MaterialsState,
} from "./materials";
import {
  createPopulationState,
  increasePopulationCapacity,
  validatePopulationState,
  type PopulationState,
} from "./population";

export type BuildingId = string;
export type BuildingType = "homes" | "farm" | "forest" | "powerPlant" | "lab";
export type BuildingStatus = "constructed";
export type BuildingIdFactory = () => BuildingId;

export interface BuildingDefinition {
  readonly type: BuildingType;
  readonly label: string;
  readonly description: string;
  readonly materialCost: number;
  readonly footprintTiles: 1;
  readonly requiredWorkers: 0;
  readonly constructionDurationSeconds: 0;
  readonly populationCapacity: number;
  readonly maxAssignedWorkers: number;
  readonly foodPerProductionInterval: number;
  readonly materialsPerProductionInterval: number;
  readonly researchPerProductionInterval: number;
  readonly productionIntervalSeconds: number;
  readonly powerOutput: number;
  readonly powerDemand: number;
  readonly powerAllocationPriority: number | null;
}

interface BaseBuildingRecord {
  readonly id: BuildingId;
  readonly status: BuildingStatus;
  readonly coordinate: Readonly<TileCoordinate>;
}

export interface HomesBuildingRecord extends BaseBuildingRecord {
  readonly type: "homes";
}

export interface FarmProductionTiming {
  readonly accumulatedMilliseconds: number;
  readonly lastUpdateMilliseconds?: number;
}

export interface FarmBuildingRecord extends BaseBuildingRecord {
  readonly type: "farm";
  readonly assignedWorkers: 0 | 1;
  readonly productionTiming: FarmProductionTiming;
}

export interface ForestProductionTiming {
  readonly accumulatedMilliseconds: number;
}

export interface ForestBuildingRecord extends BaseBuildingRecord {
  readonly type: "forest";
  readonly assignedWorkers: 0 | 1;
  readonly productionTiming: ForestProductionTiming;
}

export interface PowerPlantBuildingRecord extends BaseBuildingRecord {
  readonly type: "powerPlant";
  readonly assignedWorkers: 0 | 1;
}

export interface LabBuildingRecord extends BaseBuildingRecord {
  readonly type: "lab";
  readonly assignedWorkers: 0 | 1;
  readonly productionTiming: { readonly accumulatedMilliseconds: number };
}

export type BuildingRecord =
  | HomesBuildingRecord
  | FarmBuildingRecord
  | ForestBuildingRecord
  | PowerPlantBuildingRecord
  | LabBuildingRecord;

export interface BuildingState {
  readonly buildings: readonly BuildingRecord[];
}

export interface BuildingResearchModifiers {
  readonly costMultiplier?: number;
  readonly homesCapacityAddition?: number;
}

export type BuildingPlacementValidationResult =
  | {
      readonly status: "valid";
      readonly definition: BuildingDefinition;
      readonly coordinate: Readonly<TileCoordinate>;
    }
  | { readonly status: "out-of-bounds" }
  | { readonly status: "hidden-tile" }
  | { readonly status: "occupied-tile" }
  | { readonly status: "invalid-materials-state" }
  | {
      readonly status: "insufficient-materials";
      readonly required: number;
      readonly available: number;
    }
  | { readonly status: "invalid-building-state" }
  | { readonly status: "invalid-population-state" };

export type BuildingPlacementOperationResult =
  | {
      readonly status: "placed";
      readonly building: BuildingRecord;
      readonly buildingState: BuildingState;
      readonly materialsState: MaterialsState;
      readonly populationState: PopulationState;
      readonly materialsSpent: number;
      readonly populationCapacityAdded: number;
    }
  | Exclude<BuildingPlacementValidationResult, { status: "valid" }>
  | { readonly status: "invalid-building-id" }
  | { readonly status: "duplicate-building-id"; readonly buildingId: BuildingId };

export interface BuildingFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly materialsBefore: number;
  readonly materialsAfter: number;
  readonly occupancyBefore: string;
  readonly occupancyAfter: string;
  readonly buildingCountBefore: number;
  readonly buildingCountAfter: number;
  readonly populationBefore: PopulationState;
  readonly populationAfter: PopulationState;
  readonly revealedTilesBefore: number;
  readonly revealedTilesAfter: number;
  readonly failedPlacementsPreservedInputs: boolean;
}

export function createBuildingState(): BuildingState {
  return Object.freeze({ buildings: Object.freeze([]) });
}

export function getBuildingDefinition(
  type: BuildingType,
): BuildingDefinition {
  return BUILDING_DEFINITIONS[type];
}

export function findBuildingAt(
  state: BuildingState,
  coordinate: TileCoordinate,
): BuildingRecord | undefined {
  return state.buildings.find(
    (building) =>
      building.coordinate.x === coordinate.x &&
      building.coordinate.y === coordinate.y,
  );
}

export function validateBuildingState(state: BuildingState): boolean {
  const ids = new Set<string>();
  const coordinates = new Set<string>();

  for (const building of state.buildings) {
    const coordinateKey = `${building.coordinate.x},${building.coordinate.y}`;

    if (
      typeof building.id !== "string" ||
      building.id.trim() === "" ||
      (building.type !== "homes" &&
        building.type !== "farm" &&
        building.type !== "forest" &&
        building.type !== "powerPlant" &&
        building.type !== "lab") ||
      building.status !== "constructed" ||
      !Number.isInteger(building.coordinate.x) ||
      !Number.isInteger(building.coordinate.y) ||
      building.coordinate.x < 0 ||
      building.coordinate.y < 0 ||
      ids.has(building.id) ||
      coordinates.has(coordinateKey)
    ) {
      return false;
    }

    if (
      building.type === "farm" &&
      (building.assignedWorkers < 0 ||
        building.assignedWorkers > 1 ||
        !Number.isInteger(building.assignedWorkers) ||
        !Number.isFinite(building.productionTiming.accumulatedMilliseconds) ||
        building.productionTiming.accumulatedMilliseconds < 0 ||
        (building.productionTiming.lastUpdateMilliseconds !== undefined &&
          (!Number.isFinite(building.productionTiming.lastUpdateMilliseconds) ||
            building.productionTiming.lastUpdateMilliseconds < 0)))
    ) {
      return false;
    }

    if (
      building.type === "forest" &&
      (building.assignedWorkers < 0 ||
        building.assignedWorkers > 1 ||
        !Number.isInteger(building.assignedWorkers) ||
        !Number.isFinite(building.productionTiming.accumulatedMilliseconds) ||
        building.productionTiming.accumulatedMilliseconds < 0)
    ) {
      return false;
    }

    if (
      building.type === "powerPlant" &&
      (building.assignedWorkers < 0 ||
        building.assignedWorkers > 1 ||
        !Number.isInteger(building.assignedWorkers))
    ) {
      return false;
    }

    if (
      building.type === "lab" &&
      (building.assignedWorkers < 0 ||
        building.assignedWorkers > 1 ||
        !Number.isInteger(building.assignedWorkers) ||
        !Number.isFinite(building.productionTiming.accumulatedMilliseconds) ||
        building.productionTiming.accumulatedMilliseconds < 0)
    ) return false;

    ids.add(building.id);
    coordinates.add(coordinateKey);
  }

  return true;
}

export function validateBuildingPlacement(
  world: WorldState,
  materialsState: MaterialsState,
  buildingState: BuildingState,
  populationState: PopulationState,
  coordinate: TileCoordinate,
  type: BuildingType = "homes",
  modifiers: BuildingResearchModifiers = {},
): BuildingPlacementValidationResult {
  const occupancy = canOccupyTile(world, coordinate.x, coordinate.y);

  if (occupancy.status === "out-of-bounds") {
    return { status: "out-of-bounds" };
  }

  if (occupancy.status === "hidden") {
    return { status: "hidden-tile" };
  }

  if (occupancy.status === "already-occupied") {
    return { status: "occupied-tile" };
  }

  if (!validateMaterialsState(materialsState).valid) {
    return { status: "invalid-materials-state" };
  }

  const definition = getBuildingDefinition(type);
  const materialCost = Math.ceil(definition.materialCost * (modifiers.costMultiplier ?? 1));
  const populationCapacity = definition.populationCapacity +
    (type === "homes" ? modifiers.homesCapacityAddition ?? 0 : 0);
  const affordability = canAffordMaterials(
    materialsState,
    materialCost,
  );

  if (affordability.status !== "affordable") {
    return affordability.status === "insufficient-materials"
      ? {
          status: "insufficient-materials",
          required: materialCost,
          available: materialsState.materials,
        }
      : { status: "invalid-materials-state" };
  }

  if (!validateBuildingState(buildingState)) {
    return { status: "invalid-building-state" };
  }

  if (findBuildingAt(buildingState, coordinate) !== undefined) {
    return { status: "occupied-tile" };
  }

  if (!validatePopulationState(populationState).valid) {
    return { status: "invalid-population-state" };
  }

  if (
    populationCapacity > 0 &&
    increasePopulationCapacity(populationState, populationCapacity)
      .status !== "increased"
  ) {
    return { status: "invalid-population-state" };
  }

  return {
    status: "valid",
    definition,
    coordinate: Object.freeze({ ...coordinate }),
  };
}

export function placeBuilding(
  world: WorldState,
  materialsState: MaterialsState,
  buildingState: BuildingState,
  populationState: PopulationState,
  coordinate: TileCoordinate,
  type: BuildingType,
  idFactory: BuildingIdFactory,
  modifiers: BuildingResearchModifiers = {},
): BuildingPlacementOperationResult {
  const validation = validateBuildingPlacement(
    world,
    materialsState,
    buildingState,
    populationState,
    coordinate,
    type,
    modifiers,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  const buildingId = idFactory();

  if (typeof buildingId !== "string" || buildingId.trim() === "") {
    return { status: "invalid-building-id" };
  }

  if (buildingState.buildings.some((building) => building.id === buildingId)) {
    return { status: "duplicate-building-id", buildingId };
  }

  const nextMaterialsState = { ...materialsState };
  const materialCost = Math.ceil(validation.definition.materialCost * (modifiers.costMultiplier ?? 1));
  const populationCapacity = validation.definition.populationCapacity +
    (type === "homes" ? modifiers.homesCapacityAddition ?? 0 : 0);
  const debit = spendMaterials(
    nextMaterialsState,
    materialCost,
  );
  const populationIncrease =
    populationCapacity === 0
      ? { status: "increased" as const, state: populationState }
      : increasePopulationCapacity(
          populationState,
          populationCapacity,
        );

  if (debit.status !== "spent") {
    return debit.status === "insufficient-materials"
      ? {
          status: "insufficient-materials",
          required: materialCost,
          available: materialsState.materials,
        }
      : { status: "invalid-materials-state" };
  }

  if (populationIncrease.status !== "increased") {
    return { status: "invalid-population-state" };
  }

  const occupancy = occupyTile(world, coordinate.x, coordinate.y);

  if (occupancy.status !== "occupied") {
    return occupancy.status === "out-of-bounds"
      ? { status: "out-of-bounds" }
      : occupancy.status === "hidden"
        ? { status: "hidden-tile" }
        : { status: "occupied-tile" };
  }

  const building: BuildingRecord =
    type === "farm"
      ? Object.freeze({
          id: buildingId,
          type,
          status: "constructed",
          coordinate: Object.freeze({ ...coordinate }),
          assignedWorkers: 0,
          productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }),
        })
      : type === "forest"
        ? Object.freeze({
            id: buildingId,
            type,
            status: "constructed",
            coordinate: Object.freeze({ ...coordinate }),
            assignedWorkers: 0,
            productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }),
          })
      : type === "powerPlant"
        ? Object.freeze({
            id: buildingId,
            type,
            status: "constructed",
            coordinate: Object.freeze({ ...coordinate }),
            assignedWorkers: 0,
          })
      : type === "lab"
        ? Object.freeze({
            id: buildingId,
            type,
            status: "constructed",
            coordinate: Object.freeze({ ...coordinate }),
            assignedWorkers: 0,
            productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }),
          })
      : Object.freeze({
          id: buildingId,
          type,
          status: "constructed",
          coordinate: Object.freeze({ ...coordinate }),
        });
  const nextBuildingState: BuildingState = Object.freeze({
    buildings: Object.freeze([...buildingState.buildings, building]),
  });

  return {
    status: "placed",
    building,
    buildingState: nextBuildingState,
    materialsState: nextMaterialsState,
    populationState: populationIncrease.state,
    materialsSpent: materialCost,
    populationCapacityAdded: populationCapacity,
  };
}

export function validateBuildingFoundation(): BuildingFoundationValidationResult {
  const errors: string[] = [];
  const homesDefinition = getBuildingDefinition("homes");
  const world = createWorld();
  const materialsState = { materials: 200 };
  const buildingState = createBuildingState();
  const population = createPopulationState();

  if (population.status !== "created") {
    throw new Error("Default population must be valid.");
  }

  const coordinate = { x: 12, y: 12 };
  const tileBefore = getTile(world, coordinate.x, coordinate.y);
  const materialsBefore = materialsState.materials;
  const occupancyBefore = tileBefore?.occupancyState ?? "missing";
  const buildingCountBefore = buildingState.buildings.length;
  const populationBefore = { ...population.state };
  const revealedTilesBefore = countRevealedTiles(world);

  if (
    homesDefinition.materialCost !== 25 ||
    homesDefinition.footprintTiles !== 1 ||
    homesDefinition.requiredWorkers !== 0 ||
    homesDefinition.constructionDurationSeconds !== 0 ||
    homesDefinition.populationCapacity !== 2
  ) {
    errors.push("The centralized first-playable Homes definition is incorrect.");
  }

  const farmDefinition = getBuildingDefinition("farm");
  const farmWorld = createWorld();
  const farmMaterials = { materials: 200 };
  const farmPlacement = placeBuilding(
    farmWorld,
    farmMaterials,
    createBuildingState(),
    population.state,
    { x: 13, y: 12 },
    "farm",
    () => "farm-validation-001",
  );

  if (
    farmDefinition.materialCost !== 30 ||
    farmDefinition.footprintTiles !== 1 ||
    farmDefinition.constructionDurationSeconds !== 0 ||
    farmDefinition.maxAssignedWorkers !== 1 ||
    farmPlacement.status !== "placed" ||
    farmPlacement.materialsState.materials !== 170 ||
    farmPlacement.populationState.populationCapacity !==
      population.state.populationCapacity ||
    farmPlacement.building.type !== "farm" ||
    farmPlacement.building.assignedWorkers !== 0 ||
    getTile(farmWorld, 13, 12)?.occupancyState !== "occupied"
  ) {
    errors.push("A valid Farm placement must cost 30, occupy one tile, and start unstaffed.");
  }

  const forestDefinition = getBuildingDefinition("forest");
  const forestWorld = createWorld();
  const forestPlacement = placeBuilding(
    forestWorld,
    { materials: 40 },
    createBuildingState(),
    population.state,
    { x: 14, y: 12 },
    "forest",
    () => "forest-validation-001",
  );

  if (
    forestDefinition.label !== "Forest" ||
    forestDefinition.materialCost !== 40 ||
    forestDefinition.footprintTiles !== 1 ||
    forestDefinition.maxAssignedWorkers !== 1 ||
    forestDefinition.materialsPerProductionInterval !== 5 ||
    forestDefinition.productionIntervalSeconds !== 10 ||
    forestDefinition.description.trim() === "" ||
    forestPlacement.status !== "placed" ||
    forestPlacement.materialsState.materials !== 0 ||
    forestPlacement.building.type !== "forest" ||
    forestPlacement.building.assignedWorkers !== 0 ||
    getTile(forestWorld, 14, 12)?.occupancyState !== "occupied"
  ) {
    errors.push("A valid Forest placement must cost 40, occupy one tile, and start unstaffed.");
  }

  const powerPlantDefinition = getBuildingDefinition("powerPlant");
  const powerPlantWorld = createWorld();
  const powerPlantPlacement = placeBuilding(
    powerPlantWorld,
    { materials: 100 },
    createBuildingState(),
    population.state,
    { x: 15, y: 12 },
    "powerPlant",
    () => "power-plant-validation-001",
  );

  if (
    powerPlantDefinition.materialCost !== 60 ||
    powerPlantDefinition.maxAssignedWorkers !== 1 ||
    powerPlantDefinition.powerOutput !== 4 ||
    powerPlantDefinition.powerDemand !== 0 ||
    powerPlantDefinition.description.trim() === "" ||
    powerPlantPlacement.status !== "placed" ||
    powerPlantPlacement.materialsState.materials !== 40 ||
    powerPlantPlacement.building.type !== "powerPlant" ||
    powerPlantPlacement.building.assignedWorkers !== 0 ||
    getTile(powerPlantWorld, 15, 12)?.occupancyState !== "occupied"
  ) {
    errors.push("A Power Plant must cost 60, occupy one tile, and start unstaffed.");
  }

  const placement = placeBuilding(
    world,
    materialsState,
    buildingState,
    population.state,
    coordinate,
    "homes",
    () => "homes-validation-001",
  );

  if (
    placement.status !== "placed" ||
    placement.building.id !== "homes-validation-001" ||
    placement.materialsState.materials !== 175 ||
    placement.buildingState.buildings.length !== 1 ||
    placement.populationState.currentPopulation !== 4 ||
    placement.populationState.populationCapacity !== 6 ||
    getTile(world, coordinate.x, coordinate.y)?.occupancyState !== "occupied"
  ) {
    errors.push("A valid Homes placement must commit all required state changes.");
  }

  const successfulState = placement.status === "placed" ? placement : undefined;
  const duplicate =
    successfulState === undefined
      ? undefined
      : placeBuilding(
          world,
          successfulState.materialsState,
          successfulState.buildingState,
          successfulState.populationState,
          coordinate,
          "homes",
          () => "homes-validation-002",
        );

  if (duplicate?.status !== "occupied-tile") {
    errors.push("A duplicate tile placement must be rejected as occupied.");
  }

  const failureChecks = [
    expectPlacementFailure({ x: 0, y: 0 }, 200, "hidden-tile"),
    expectPlacementFailure({ x: 12, y: 12 }, 24, "insufficient-materials"),
    expectOccupiedPlacementFailure(),
    expectInvalidMaterialsStateFailure(),
    expectInvalidBuildingStateFailure(),
    expectInvalidPopulationStateFailure(),
  ];
  const failedPlacementsPreservedInputs = failureChecks.every(Boolean);

  if (!failedPlacementsPreservedInputs) {
    errors.push("All failed placements must preserve every supplied state.");
  }

  const materialsAfter =
    successfulState?.materialsState.materials ?? materialsBefore;
  const buildingCountAfter =
    successfulState?.buildingState.buildings.length ?? buildingCountBefore;
  const populationAfter =
    successfulState === undefined
      ? populationBefore
      : { ...successfulState.populationState };
  const occupancyAfter =
    getTile(world, coordinate.x, coordinate.y)?.occupancyState ?? "missing";
  const revealedTilesAfter = countRevealedTiles(world);

  if (revealedTilesAfter !== revealedTilesBefore) {
    errors.push("Building placement must never mutate world reveal state.");
  }

  return {
    valid: errors.length === 0,
    errors,
    materialsBefore,
    materialsAfter,
    occupancyBefore,
    occupancyAfter,
    buildingCountBefore,
    buildingCountAfter,
    populationBefore,
    populationAfter,
    revealedTilesBefore,
    revealedTilesAfter,
    failedPlacementsPreservedInputs,
  };
}

function expectPlacementFailure(
  coordinate: TileCoordinate,
  materials: number,
  expectedStatus: BuildingPlacementOperationResult["status"],
): boolean {
  const world = createWorld();
  const materialsState = { materials };
  const buildingState = createBuildingState();
  const population = createPopulationState();

  if (population.status !== "created") {
    return false;
  }

  const before = snapshotInputs(world, materialsState, buildingState, population.state);
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    population.state,
    coordinate,
    "homes",
    () => "failed-placement",
  );
  const after = snapshotInputs(world, materialsState, buildingState, population.state);

  return result.status === expectedStatus && before === after;
}

function expectOccupiedPlacementFailure(): boolean {
  const world = createWorld();
  const population = createPopulationState();

  if (
    population.status !== "created" ||
    occupyTile(world, 12, 12).status !== "occupied"
  ) {
    return false;
  }

  const materialsState = { materials: 200 };
  const buildingState = createBuildingState();
  const before = snapshotInputs(world, materialsState, buildingState, population.state);
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    population.state,
    { x: 12, y: 12 },
    "homes",
    () => "occupied-placement",
  );
  const after = snapshotInputs(world, materialsState, buildingState, population.state);

  return result.status === "occupied-tile" && before === after;
}

function expectInvalidMaterialsStateFailure(): boolean {
  const world = createWorld();
  const materialsState = { materials: -1 };
  const buildingState = createBuildingState();
  const population = createPopulationState();

  if (population.status !== "created") {
    return false;
  }

  const before = snapshotInputs(world, materialsState, buildingState, population.state);
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    population.state,
    { x: 12, y: 12 },
    "homes",
    () => "invalid-state-placement",
  );
  const after = snapshotInputs(world, materialsState, buildingState, population.state);

  return result.status === "invalid-materials-state" && before === after;
}

function expectInvalidBuildingStateFailure(): boolean {
  const world = createWorld();
  const materialsState = { materials: 200 };
  const invalidBuilding: BuildingRecord = {
    id: "duplicate-building",
    type: "homes",
    status: "constructed",
    coordinate: { x: 13, y: 13 },
  };
  const buildingState: BuildingState = {
    buildings: [invalidBuilding, { ...invalidBuilding }],
  };
  const population = createPopulationState();

  if (population.status !== "created") {
    return false;
  }

  const before = snapshotInputs(world, materialsState, buildingState, population.state);
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    population.state,
    { x: 12, y: 12 },
    "homes",
    () => "invalid-building-state-placement",
  );
  const after = snapshotInputs(world, materialsState, buildingState, population.state);

  return result.status === "invalid-building-state" && before === after;
}

function expectInvalidPopulationStateFailure(): boolean {
  const world = createWorld();
  const materialsState = { materials: 200 };
  const buildingState = createBuildingState();
  const populationState: PopulationState = {
    currentPopulation: 5,
    populationCapacity: 4,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "pending",
    totalSuppliedCycles: 0,
    totalUnsuppliedCycles: 0,
  };
  const before = snapshotInputs(world, materialsState, buildingState, populationState);
  const result = placeBuilding(
    world,
    materialsState,
    buildingState,
    populationState,
    { x: 12, y: 12 },
    "homes",
    () => "invalid-population-state-placement",
  );
  const after = snapshotInputs(world, materialsState, buildingState, populationState);

  return result.status === "invalid-population-state" && before === after;
}

function snapshotInputs(
  world: WorldState,
  materialsState: MaterialsState,
  buildingState: BuildingState,
  populationState: PopulationState,
): string {
  return JSON.stringify({ world, materialsState, buildingState, populationState });
}
