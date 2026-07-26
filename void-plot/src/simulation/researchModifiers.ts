import { getTechnologyDefinition } from "../data/researchDefinitions";
import type { ResearchState } from "./research";

export interface ResearchModifierSnapshot {
  readonly farmProductionMultiplier: number;
  readonly forestProductionMultiplier: number;
  readonly powerPlantOutputAddition: number;
  readonly expeditionCostMultiplier: number;
  readonly expeditionDurationMultiplier: number;
  readonly buildingCostMultiplier: number;
  readonly homesCapacityAddition: number;
  readonly recruitmentFoodCost: number;
  readonly populationGrowthIntervalMultiplier: number;
}

export function calculateResearchModifiers(state: ResearchState): ResearchModifierSnapshot {
  const snapshot = { farmProductionMultiplier: 1, forestProductionMultiplier: 1, powerPlantOutputAddition: 0, expeditionCostMultiplier: 1, expeditionDurationMultiplier: 1, buildingCostMultiplier: 1, homesCapacityAddition: 0, recruitmentFoodCost: 10, populationGrowthIntervalMultiplier: 1 };
  for (const id of state.completedTechnologies) {
    for (const effect of getTechnologyDefinition(id)?.effects ?? []) {
      switch (effect.type) {
        case "farm-production-multiplier": snapshot.farmProductionMultiplier += effect.value - 1; break;
        case "forest-production-multiplier": snapshot.forestProductionMultiplier += effect.value - 1; break;
        case "power-plant-output-addition": snapshot.powerPlantOutputAddition += effect.value; break;
        case "expedition-cost-multiplier": snapshot.expeditionCostMultiplier *= effect.value; break;
        case "expedition-duration-multiplier": snapshot.expeditionDurationMultiplier *= effect.value; break;
        case "building-cost-multiplier": snapshot.buildingCostMultiplier *= effect.value; break;
        case "homes-capacity-addition": snapshot.homesCapacityAddition += effect.value; break;
        case "recruitment-cost": snapshot.recruitmentFoodCost = effect.value; break;
        case "population-growth-interval-multiplier": snapshot.populationGrowthIntervalMultiplier *= effect.value; break;
      }
    }
  }
  return Object.freeze(snapshot);
}

export function applyCostMultiplier(baseCost: number, multiplier: number): number {
  return Math.max(0, Math.ceil(baseCost * multiplier));
}

export function validateResearchModifierFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const state = { researchPoints: 0, completedTechnologies: Object.freeze(["efficient-farming", "sustainable-forestry", "survey-equipment", "efficient-turbines", "improved-housing", "worker-training", "industrial-tools", "advanced-agriculture", "expedition-planning", "colony-optimization"] as const), accumulatedResearchProgress: 0, completedOrder: Object.freeze(["efficient-farming", "sustainable-forestry", "survey-equipment", "efficient-turbines", "improved-housing", "worker-training", "industrial-tools", "advanced-agriculture", "expedition-planning", "colony-optimization"] as const), validationStatus: "valid" as const };
  const modifiers = calculateResearchModifiers(state);
  const valid = Math.abs(modifiers.farmProductionMultiplier - 1.3) < 0.0001 && Math.abs(modifiers.forestProductionMultiplier - 1.3) < 0.0001 && modifiers.powerPlantOutputAddition === 2 && modifiers.expeditionCostMultiplier === 0.8 && modifiers.expeditionDurationMultiplier === 0.8 && modifiers.buildingCostMultiplier === 0.9 && modifiers.homesCapacityAddition === 1 && modifiers.recruitmentFoodCost === 8 && modifiers.populationGrowthIntervalMultiplier === 0.8;
  return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Research modifiers did not compose correctly."]) };
}
