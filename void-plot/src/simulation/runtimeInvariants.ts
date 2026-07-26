import { BEACON_PHASES, getEventDefinition, getTechnologyDefinition } from "../data";
import { countOccupiedTiles, getTile, type WorldState } from "../world";
import type { BeaconState } from "./beacon";
import { validateBuildingState, type BuildingState } from "./buildings";
import type { DynamicEventState } from "./events";
import type { FoodState } from "./food";
import type { MaterialsState } from "./materials";
import type { ModifierState } from "./eventModifiers";
import type { PopulationState } from "./population";
import { validateResearchState, type ResearchState } from "./research";
import type { WorkersState } from "./workers";

export interface RuntimeInvariantSnapshot {
  readonly world: WorldState;
  readonly buildings: BuildingState;
  readonly food: FoodState;
  readonly materials: MaterialsState;
  readonly population: PopulationState;
  readonly workers: WorkersState;
  readonly research: ResearchState;
  readonly events: DynamicEventState;
  readonly modifiers: ModifierState;
  readonly beacon: BeaconState;
}

export interface RuntimeInvariantResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateRuntimeInvariants(snapshot: RuntimeInvariantSnapshot): RuntimeInvariantResult {
  const errors: string[] = [];
  const nonNegativeFinite = (label: string, value: number): void => {
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be finite and non-negative.`);
  };
  nonNegativeFinite("Food", snapshot.food.food);
  nonNegativeFinite("Materials", snapshot.materials.materials);
  nonNegativeFinite("Research Points", snapshot.research.researchPoints);
  nonNegativeFinite("Population", snapshot.population.currentPopulation);
  nonNegativeFinite("Event elapsed timer", snapshot.events.elapsedSinceLastEventMilliseconds);
  nonNegativeFinite("Event delay timer", snapshot.events.nextEventDelayMilliseconds);
  nonNegativeFinite("Beacon run timer", snapshot.beacon.elapsedRunMilliseconds);
  nonNegativeFinite("Beacon phase timer", snapshot.beacon.elapsedPhaseMilliseconds);
  nonNegativeFinite("Beacon countdown", snapshot.beacon.nextPhaseCountdownMilliseconds);

  if (snapshot.workers.availableWorkers > snapshot.workers.totalWorkers) errors.push("Available workers exceed total workers.");
  if (snapshot.workers.assignedWorkers > snapshot.workers.totalWorkers) errors.push("Assigned workers exceed total workers.");
  if (snapshot.workers.availableWorkers + snapshot.workers.assignedWorkers !== snapshot.workers.totalWorkers) errors.push("Worker totals do not balance.");
  if (!validateBuildingState(snapshot.buildings)) errors.push("Building IDs, coordinates, or records are invalid or duplicated.");
  if (countOccupiedTiles(snapshot.world) !== snapshot.buildings.buildings.length) errors.push("Occupied tile count does not match constructed buildings.");
  for (const building of snapshot.buildings.buildings) {
    const tile = getTile(snapshot.world, building.coordinate.x, building.coordinate.y);
    if (tile?.occupancyState !== "occupied") errors.push(`Building ${building.id} does not own an occupied tile.`);
  }
  if (!validateResearchState(snapshot.research)) errors.push("Research target, completion order, or completed technologies are invalid.");
  if (snapshot.events.activeEventId !== undefined && getEventDefinition(snapshot.events.activeEventId) === undefined) errors.push("Active event ID is invalid.");
  if (snapshot.modifiers.modifiers.some((modifier) => !Number.isFinite(modifier.remainingDurationMilliseconds) || modifier.remainingDurationMilliseconds <= 0)) errors.push("Expired or invalid temporary modifier remains active.");
  if (!BEACON_PHASES.some((phase) => phase.phase === snapshot.beacon.currentPhase && phase.number === snapshot.beacon.phaseNumber)) errors.push("Beacon phase is invalid.");
  if (snapshot.research.activeTechnology !== undefined && getTechnologyDefinition(snapshot.research.activeTechnology) === undefined) errors.push("Active research target does not exist.");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
