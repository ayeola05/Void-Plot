import type { BuildingState } from "./buildings";
import { advanceFarmProduction } from "./farms";
import { advanceForestProduction } from "./forests";
import { processPopulationFoodConsumption, type PopulationState } from "./population";
import { calculatePowerAllocation, type PowerAllocationSnapshot } from "./power";

export function validateBeaconIntegrationFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const productionBuildings: BuildingState = Object.freeze({ buildings: Object.freeze([
    { id: "plant", type: "powerPlant" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const },
    { id: "lab", type: "lab" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 13, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }) },
  ]) });
  const power = calculatePowerAllocation(productionBuildings, { powerPlantOutputAdjustment: 0, staffedProductionDemandAddition: 1 });
  if (power.status !== "calculated" || power.snapshot.totalPowerGenerated !== 4 || power.snapshot.totalPowerDemand !== 2) errors.push("Beacon Power generation/demand composition failed.");

  const farmState: BuildingState = Object.freeze({ buildings: Object.freeze([{ id: "farm", type: "farm" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0, lastUpdateMilliseconds: 0 }) }]) });
  const farm = advanceFarmProduction(farmState, { food: 0 }, 100_000, powered("farm"), { productionRateMultiplier: 1.3 * 0.5 * 0.7 });
  if (farm.status !== "advanced" || farm.foodProduced !== 9) errors.push("Research, Event, and Beacon Farm modifiers must stack.");

  const forestState: BuildingState = Object.freeze({ buildings: Object.freeze([{ id: "forest", type: "forest" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }) }]) });
  const forest = advanceForestProduction(forestState, { materials: 0 }, 100_000, powered("forest"), { productionRateMultiplier: 1.3 * 0.7, bonusMaterialsPerInterval: 2 });
  if (forest.status !== "advanced" || forest.materialsProduced !== 63) errors.push("Research, Event, and Beacon Forest modifiers must stack.");

  const population: PopulationState = { currentPopulation: 4, populationCapacity: 4, accumulatedConsumptionMilliseconds: 0, accumulatedGrowthMilliseconds: 0, latestSupplyStatus: "supplied", totalSuppliedCycles: 0, totalUnsuppliedCycles: 0 };
  const consumption = processPopulationFoodConsumption(population, { food: 10 }, 20_000, 1.35);
  if (consumption.status !== "processed" || consumption.events[0]?.foodConsumed !== 6) errors.push("Beacon Food-consumption modifier failed.");
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

function powered(id: string): PowerAllocationSnapshot {
  return Object.freeze({ totalPowerGenerated: 12, totalPowerDemand: 1, totalPowerAllocated: 1, availablePower: 11, poweredBuildingIds: Object.freeze([id]), unpoweredBuildingIds: Object.freeze([]), allocations: Object.freeze([]) });
}
