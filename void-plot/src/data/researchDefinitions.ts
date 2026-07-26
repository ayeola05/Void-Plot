export const DEFAULT_INITIAL_RESEARCH_POINTS = 0;
export const LAB_MATERIAL_COST = 80;
export const LAB_POWER_DEMAND = 1;
export const LAB_RESEARCH_PER_INTERVAL = 1;
export const LAB_RESEARCH_INTERVAL_SECONDS = 5;

export type TechnologyId =
  | "efficient-farming"
  | "sustainable-forestry"
  | "survey-equipment"
  | "efficient-turbines"
  | "improved-housing"
  | "worker-training"
  | "industrial-tools"
  | "advanced-agriculture"
  | "expedition-planning"
  | "colony-optimization";

export type TechnologyEffect =
  | { readonly type: "farm-production-multiplier"; readonly value: number }
  | { readonly type: "forest-production-multiplier"; readonly value: number }
  | { readonly type: "expedition-cost-multiplier"; readonly value: number }
  | { readonly type: "power-plant-output-addition"; readonly value: number }
  | { readonly type: "homes-capacity-addition"; readonly value: number }
  | { readonly type: "recruitment-cost"; readonly value: number }
  | { readonly type: "building-cost-multiplier"; readonly value: number }
  | { readonly type: "population-growth-interval-multiplier"; readonly value: number }
  | { readonly type: "expedition-duration-multiplier"; readonly value: number };

export interface TechnologyDefinition {
  readonly id: TechnologyId;
  readonly label: string;
  readonly tier: 1 | 2 | 3 | 4;
  readonly cost: number;
  readonly prerequisite: { readonly type: "none" } | { readonly type: "any" | "all"; readonly technologyIds: readonly TechnologyId[] };
  readonly effects: readonly TechnologyEffect[];
}

const none = Object.freeze({ type: "none" as const });
const any = (...technologyIds: TechnologyId[]) => Object.freeze({ type: "any" as const, technologyIds: Object.freeze(technologyIds) });
const all = (...technologyIds: TechnologyId[]) => Object.freeze({ type: "all" as const, technologyIds: Object.freeze(technologyIds) });
const fx = (effects: readonly TechnologyEffect[]) => Object.freeze(effects);

export const TECHNOLOGY_DEFINITIONS: readonly TechnologyDefinition[] = Object.freeze([
  { id: "efficient-farming", label: "Efficient Farming", tier: 1, cost: 10, prerequisite: none, effects: fx([{ type: "farm-production-multiplier", value: 1.2 }]) },
  { id: "sustainable-forestry", label: "Sustainable Forestry", tier: 1, cost: 10, prerequisite: none, effects: fx([{ type: "forest-production-multiplier", value: 1.2 }]) },
  { id: "survey-equipment", label: "Survey Equipment", tier: 1, cost: 8, prerequisite: none, effects: fx([{ type: "expedition-cost-multiplier", value: 0.8 }]) },
  { id: "efficient-turbines", label: "Efficient Turbines", tier: 2, cost: 15, prerequisite: any("efficient-farming", "sustainable-forestry"), effects: fx([{ type: "power-plant-output-addition", value: 1 }]) },
  { id: "improved-housing", label: "Improved Housing", tier: 2, cost: 15, prerequisite: all("survey-equipment"), effects: fx([{ type: "homes-capacity-addition", value: 1 }]) },
  { id: "worker-training", label: "Worker Training", tier: 2, cost: 12, prerequisite: all("survey-equipment"), effects: fx([{ type: "recruitment-cost", value: 8 }]) },
  { id: "industrial-tools", label: "Industrial Tools", tier: 3, cost: 20, prerequisite: all("efficient-turbines"), effects: fx([{ type: "building-cost-multiplier", value: 0.9 }]) },
  { id: "advanced-agriculture", label: "Advanced Agriculture", tier: 3, cost: 18, prerequisite: all("efficient-farming"), effects: fx([{ type: "population-growth-interval-multiplier", value: 0.8 }]) },
  { id: "expedition-planning", label: "Expedition Planning", tier: 3, cost: 18, prerequisite: all("survey-equipment"), effects: fx([{ type: "expedition-duration-multiplier", value: 0.8 }]) },
  { id: "colony-optimization", label: "Colony Optimization", tier: 4, cost: 30, prerequisite: all("industrial-tools", "advanced-agriculture", "expedition-planning"), effects: fx([{ type: "farm-production-multiplier", value: 1.1 }, { type: "forest-production-multiplier", value: 1.1 }, { type: "power-plant-output-addition", value: 1 }]) },
]);

export function getTechnologyDefinition(id: TechnologyId): TechnologyDefinition | undefined {
  return TECHNOLOGY_DEFINITIONS.find((technology) => technology.id === id);
}
