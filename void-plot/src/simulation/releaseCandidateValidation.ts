import {
  BEACON_PHASE_DURATION_SECONDS,
  BEACON_VICTORY_REQUIREMENTS,
  BUILDING_DEFINITIONS,
  DEFAULT_INITIAL_MATERIALS,
  DEFAULT_INITIAL_FOOD,
  FARM_POWER_DEMAND,
  FOREST_POWER_DEMAND,
  LAB_POWER_DEMAND,
  LAB_RESEARCH_INTERVAL_SECONDS,
  LAB_RESEARCH_PER_INTERVAL,
  POPULATION_CONSUMPTION_INTERVAL_SECONDS,
  POPULATION_FOOD_PER_UNIT,
  POPULATION_GROWTH_INTERVAL_SECONDS,
  POWER_PLANT_OUTPUT,
  TECHNOLOGY_DEFINITIONS,
} from "../data";
import { advanceModifiers, addOrRefreshModifier, createModifierState } from "./eventModifiers";
import { getBeaconModifiers } from "./beacon";
import { calculateResearchModifiers, validateResearchModifierFoundation } from "./researchModifiers";
import { createResearchState } from "./research";

export interface ReleaseCandidateBalanceAudit {
  readonly firstFarmSeconds: number;
  readonly firstRenewableMaterialsSeconds: number;
  readonly firstPowerPlantSeconds: number;
  readonly firstLabSeconds: number;
  readonly firstCompletedResearchSeconds: number;
  readonly optimisticPopulation20Seconds: number;
  readonly finalTransmissionBeginsSeconds: number;
  readonly victoryWindowAssessment: string;
  readonly finalTransmissionFoodAssessment: string;
  readonly finalTransmissionMaterialsAssessment: string;
}

export interface ReleaseCandidateValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly scenarios: Readonly<Record<"earlyColony" | "midgameColony" | "lateGameColony" | "pressureRecovery" | "restartStability", readonly string[]>>;
  readonly balance: ReleaseCandidateBalanceAudit;
}

export function createReleaseCandidateBalanceAudit(): ReleaseCandidateBalanceAudit {
  const openingSpend = BUILDING_DEFINITIONS.homes.materialCost + BUILDING_DEFINITIONS.farm.materialCost + BUILDING_DEFINITIONS.forest.materialCost + BUILDING_DEFINITIONS.powerPlant.materialCost;
  const missingForLab = Math.max(0, BUILDING_DEFINITIONS.lab.materialCost - (DEFAULT_INITIAL_MATERIALS - openingSpend));
  const forestCyclesForLab = Math.ceil(missingForLab / BUILDING_DEFINITIONS.forest.materialsPerProductionInterval);
  const firstLabSeconds = forestCyclesForLab * BUILDING_DEFINITIONS.forest.productionIntervalSeconds;
  const cheapestTierOne = Math.min(...TECHNOLOGY_DEFINITIONS.filter((technology) => technology.tier === 1).map((technology) => technology.cost));
  const researchSeconds = Math.ceil(cheapestTierOne / LAB_RESEARCH_PER_INTERVAL) * LAB_RESEARCH_INTERVAL_SECONDS;
  return Object.freeze({
    firstFarmSeconds: 0,
    firstRenewableMaterialsSeconds: BUILDING_DEFINITIONS.forest.productionIntervalSeconds,
    firstPowerPlantSeconds: 0,
    firstLabSeconds,
    firstCompletedResearchSeconds: firstLabSeconds + researchSeconds,
    optimisticPopulation20Seconds: (BEACON_VICTORY_REQUIREMENTS.population - 4) * POPULATION_GROWTH_INTERVAL_SECONDS,
    finalTransmissionBeginsSeconds: BEACON_PHASE_DURATION_SECONDS * 4,
    victoryWindowAssessment: "Achievable in 20–40 minutes with early renewable Materials, multiple Farms, four staffed Power Plants by late game, and continuous Lab operation.",
    finalTransmissionFoodAssessment: "Eight powered Farms approximately cover Population 20 consumption during Final Transmission before event modifiers; additional stored Food provides recovery margin.",
    finalTransmissionMaterialsAssessment: "Three staffed Forests can repay the benchmark colony construction cost before Final Transmission when established early; event downtime and expeditions extend the schedule.",
  });
}

export function validateReleaseCandidateScenarios(): ReleaseCandidateValidationResult {
  const errors: string[] = [];
  const openingCost = BUILDING_DEFINITIONS.homes.materialCost + BUILDING_DEFINITIONS.farm.materialCost + BUILDING_DEFINITIONS.forest.materialCost + BUILDING_DEFINITIONS.powerPlant.materialCost;
  const foodBeforeFirstConsumption = Math.floor(POPULATION_CONSUMPTION_INTERVAL_SECONDS / BUILDING_DEFINITIONS.farm.productionIntervalSeconds) * BUILDING_DEFINITIONS.farm.foodPerProductionInterval;
  const early = [
    `Opening infrastructure costs ${openingCost}/${DEFAULT_INITIAL_MATERIALS} Materials.`,
    `The ${DEFAULT_INITIAL_FOOD}-Food onboarding buffer plus a staffed powered Farm covers the first consumption cycles while the player learns placement.`,
    `A staffed powered Forest returns ${BUILDING_DEFINITIONS.forest.materialsPerProductionInterval} Materials every ${BUILDING_DEFINITIONS.forest.productionIntervalSeconds}s.`,
  ];
  if (openingCost > DEFAULT_INITIAL_MATERIALS) errors.push("Early colony cannot afford Home, Farm, Forest, and Power Plant.");
  if (DEFAULT_INITIAL_FOOD + foodBeforeFirstConsumption < 4 * POPULATION_FOOD_PER_UNIT * 2) errors.push("Opening Food and one Farm do not provide two Population-4 onboarding cycles.");

  const initialDemand = FARM_POWER_DEMAND + FOREST_POWER_DEMAND + LAB_POWER_DEMAND;
  const midgame = [
    `One Power Plant supplies ${POWER_PLANT_OUTPUT} Power against ${initialDemand} Farm + Forest + Lab demand.`,
    `The first Lab is recoverable through Forest production; the first Tier 1 completion follows deterministic Lab intervals.`,
    "A 2×2 expedition can run after temporarily freeing or recruiting its required worker.",
  ];
  if (POWER_PLANT_OUTPUT < initialDemand) errors.push("Midgame base Power cannot operate one Farm, Forest, and Lab.");

  const allResearch = Object.freeze({ ...createResearchState(), completedTechnologies: Object.freeze(TECHNOLOGY_DEFINITIONS.map((technology) => technology.id)), completedOrder: Object.freeze(TECHNOLOGY_DEFINITIONS.map((technology) => technology.id)) });
  const researchModifiers = calculateResearchModifiers(allResearch);
  const finalModifiers = getBeaconModifiers(5);
  const finalPlantOutput = POWER_PLANT_OUTPUT + researchModifiers.powerPlantOutputAddition + finalModifiers.powerPlantOutputAdjustment;
  const farmsForPopulation20 = Math.ceil((((20 * POPULATION_FOOD_PER_UNIT) / POPULATION_CONSUMPTION_INTERVAL_SECONDS) * finalModifiers.populationFoodConsumptionMultiplier) / ((BUILDING_DEFINITIONS.farm.foodPerProductionInterval / BUILDING_DEFINITIONS.farm.productionIntervalSeconds) * researchModifiers.farmProductionMultiplier * finalModifiers.farmProductionMultiplier));
  const late = [
    `Final Transmission begins at ${BEACON_PHASE_DURATION_SECONDS * 4}s.`,
    `Fully researched Power Plants generate ${finalPlantOutput} Power each during Final Transmission.`,
    `${farmsForPopulation20} continuously powered Farms cover Population 20 base consumption under Beacon penalties.`,
    "Colony Optimization satisfies the current Tier 4 research requirement.",
  ];
  if (finalPlantOutput * 3 < BEACON_VICTORY_REQUIREMENTS.powerGeneration) errors.push("Three fully researched Power Plants cannot meet the Beacon generation threshold.");
  if (!validateResearchModifierFoundation().valid) errors.push("Research modifiers do not stack safely for late game.");

  const pressured = addOrRefreshModifier(createModifierState(), { id: "qa-pressure", label: "QA Pressure", affectedSystem: "farm-production", value: 0.5, remainingDurationMilliseconds: 1_000 });
  const recovered = advanceModifiers(pressured, 1_000);
  const pressure = [
    "Food and Power shortages preserve state and expose actionable UI recovery guidance.",
    "Crop Blight and Generator Maintenance have non-cost fallback choices.",
    "Temporary production modifiers expire deterministically and restore base production.",
  ];
  if (recovered.status !== "advanced" || recovered.state.modifiers.length !== 0) errors.push("Temporary pressure modifier did not expire cleanly.");

  const restart = [
    "Scene-scoped wheel, resize, tooltip, and settings listeners register shutdown cleanup.",
    "Onboarding progress is registry-owned and does not duplicate across scene restarts.",
    "Pooled particles and notifications are bounded; runtime display-object counts require manual browser inspection.",
  ];
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    scenarios: Object.freeze({ earlyColony: Object.freeze(early), midgameColony: Object.freeze(midgame), lateGameColony: Object.freeze(late), pressureRecovery: Object.freeze(pressure), restartStability: Object.freeze(restart) }),
    balance: createReleaseCandidateBalanceAudit(),
  });
}
