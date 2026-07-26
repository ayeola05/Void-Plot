import { createBuildingState, validateBuildingPlacement, type BuildingState } from "./buildings";
import { createWorld } from "../world";
import { createPopulationState } from "./population";
import { getExpeditionRequirements } from "./expedition";
import { advanceFarmProduction } from "./farms";
import { advanceForestProduction } from "./forests";
import { calculatePowerAllocation, type PowerAllocationSnapshot } from "./power";
import { validateWorkerRecruitment } from "./recruitment";
import { applyCostMultiplier, calculateResearchModifiers } from "./researchModifiers";
import type { ResearchState } from "./research";

export function validateResearchIntegrationFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const completed = Object.freeze(["efficient-farming", "sustainable-forestry", "survey-equipment", "efficient-turbines", "improved-housing", "worker-training", "industrial-tools", "advanced-agriculture", "expedition-planning", "colony-optimization"] as const);
  const state: ResearchState = { researchPoints: 0, completedTechnologies: completed, accumulatedResearchProgress: 0, completedOrder: completed, validationStatus: "valid" };
  const modifiers = calculateResearchModifiers(state);
  const population = createPopulationState();
  const labPlacement = population.status === "created" ? validateBuildingPlacement(createWorld(), { materials: 80 }, createBuildingState(), population.state, { x: 12, y: 12 }, "lab") : undefined;
  if (labPlacement?.status !== "valid") errors.push("Lab placement validation failed.");
  const powerState: BuildingState = Object.freeze({ buildings: Object.freeze([{ id: "power", type: "powerPlant" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const }]) });
  const power = calculatePowerAllocation(powerState, { powerPlantOutputAdjustment: modifiers.powerPlantOutputAddition });
  if (power.status !== "calculated" || power.snapshot.totalPowerGenerated !== 6) errors.push("Research Power modifier failed.");
  const farmState: BuildingState = Object.freeze({ buildings: Object.freeze([{ id: "farm", type: "farm" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0, lastUpdateMilliseconds: 0 }) }]) });
  const farm = advanceFarmProduction(farmState, { food: 0 }, 25_000, powered("farm"), { productionRateMultiplier: modifiers.farmProductionMultiplier });
  if (farm.status !== "advanced" || farm.foodProduced !== 6) errors.push("Research Farm modifier failed.");
  const forestState: BuildingState = Object.freeze({ buildings: Object.freeze([{ id: "forest", type: "forest" as const, status: "constructed" as const, coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1 as const, productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }) }]) });
  const forest = advanceForestProduction(forestState, { materials: 0 }, 50_000, powered("forest"), { productionRateMultiplier: modifiers.forestProductionMultiplier });
  if (forest.status !== "advanced" || forest.materialsProduced !== 30) errors.push("Research Forest modifier failed.");
  if (applyCostMultiplier(80, modifiers.buildingCostMultiplier) !== 72) errors.push("Building cost modifier failed.");
  const recruitment = validateWorkerRecruitment({ currentPopulation: 5, populationCapacity: 6, accumulatedConsumptionMilliseconds: 0, accumulatedGrowthMilliseconds: 0, latestSupplyStatus: "supplied", totalSuppliedCycles: 1, totalUnsuppliedCycles: 0 }, { totalWorkers: 4, availableWorkers: 4, assignedWorkers: 0 }, { food: 8 }, modifiers.recruitmentFoodCost);
  if (recruitment.status !== "ready" || recruitment.foodCost !== 8) errors.push("Recruitment modifier failed.");
  const expedition = getExpeditionRequirements(2, { materialCostMultiplier: modifiers.expeditionCostMultiplier, durationMultiplier: modifiers.expeditionDurationMultiplier });
  if (expedition.materialCost !== 16 || expedition.durationSeconds !== 24) errors.push("Expedition modifiers failed.");
  if (modifiers.homesCapacityAddition !== 1 || modifiers.populationGrowthIntervalMultiplier !== 0.8) errors.push("Housing or population modifier failed.");
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

function powered(id: string): PowerAllocationSnapshot {
  return Object.freeze({ totalPowerGenerated: 6, totalPowerDemand: 1, totalPowerAllocated: 1, availablePower: 5, poweredBuildingIds: Object.freeze([id]), unpoweredBuildingIds: Object.freeze([]), allocations: Object.freeze([]) });
}
