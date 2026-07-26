import type { BuildingState } from "./buildings";
import { advanceFarmProduction } from "./farms";
import { advanceForestProduction } from "./forests";
import { calculatePowerAllocation, type PowerAllocationSnapshot } from "./power";

export interface EventIntegrationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateEventIntegrationFoundation(): EventIntegrationValidationResult {
  const errors: string[] = [];
  const plantState: BuildingState = Object.freeze({
    buildings: Object.freeze([
      Object.freeze({ id: "plant", type: "powerPlant" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const }),
    ]),
  });
  const normalPower = calculatePowerAllocation(plantState);
  const reducedPower = calculatePowerAllocation(plantState, { powerPlantOutputAdjustment: -1 });
  if (
    normalPower.status !== "calculated" ||
    reducedPower.status !== "calculated" ||
    reducedPower.snapshot.totalPowerGenerated !== Math.max(0, normalPower.snapshot.totalPowerGenerated - 1)
  ) {
    errors.push("The power modifier must reduce each staffed plant by one, with a zero floor.");
  }

  const farmState: BuildingState = Object.freeze({
    buildings: Object.freeze([
      Object.freeze({ id: "farm", type: "farm" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0, lastUpdateMilliseconds: 0 }) }),
    ]),
  });
  const farmPower = poweredSnapshot("farm");
  const normalFarm = advanceFarmProduction(farmState, { food: 0 }, 10_000, farmPower);
  const blightedFarm = advanceFarmProduction(farmState, { food: 0 }, 10_000, farmPower, { productionRateMultiplier: 0.5 });
  if (
    normalFarm.status !== "advanced" ||
    blightedFarm.status !== "advanced" ||
    normalFarm.foodProduced !== 2 ||
    blightedFarm.foodProduced !== 1
  ) {
    errors.push("Crop Blight must halve Farm production without replacing Farm state.");
  }

  const forestState: BuildingState = Object.freeze({
    buildings: Object.freeze([
      Object.freeze({ id: "forest", type: "forest" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }) }),
    ]),
  });
  const forestPower = poweredSnapshot("forest");
  const normalForest = advanceForestProduction(forestState, { materials: 0 }, 10_000, forestPower);
  const richForest = advanceForestProduction(forestState, { materials: 0 }, 10_000, forestPower, { bonusMaterialsPerInterval: 2 });
  if (
    normalForest.status !== "advanced" ||
    richForest.status !== "advanced" ||
    normalForest.materialsProduced !== 5 ||
    richForest.materialsProduced !== 7
  ) {
    errors.push("Rich Forest must add two Materials to each completed Forest interval.");
  }

  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

function poweredSnapshot(buildingId: string): PowerAllocationSnapshot {
  return Object.freeze({
    totalPowerGenerated: 4,
    totalPowerDemand: 1,
    totalPowerAllocated: 1,
    availablePower: 3,
    poweredBuildingIds: Object.freeze([buildingId]),
    unpoweredBuildingIds: Object.freeze([]),
    allocations: Object.freeze([]),
  });
}
