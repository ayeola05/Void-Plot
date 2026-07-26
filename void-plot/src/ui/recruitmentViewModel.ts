import {
  getRecruitableWorkerCount,
  validateWorkerRecruitment,
  type FoodState,
  type PopulationState,
  type RecruitmentValidationResult,
  type WorkersState,
} from "../simulation";

export interface RecruitmentPanelViewModel {
  readonly recruitableWorkers: number;
  readonly enabled: boolean;
  readonly buttonText: string;
  readonly reason: string;
  readonly validation: RecruitmentValidationResult;
}

export interface RecruitmentPanelFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function createRecruitmentPanelViewModel(
  population: PopulationState,
  workers: WorkersState,
  food: FoodState,
  foodCost?: number,
): RecruitmentPanelViewModel {
  const validation = validateWorkerRecruitment(population, workers, food, foodCost);

  return {
    recruitableWorkers: getRecruitableWorkerCount(population, workers),
    enabled: validation.status === "ready",
    buttonText: `Recruit Worker — ${validation.foodCost} Food`,
    reason: formatRecruitmentDisabledReason(validation),
    validation,
  };
}

export function formatRecruitmentDisabledReason(
  validation: RecruitmentValidationResult,
): string {
  switch (validation.status) {
    case "ready":
      return "Ready to recruit";
    case "worker-population-parity":
      return "Population is at its worker limit. Add Homes and allow population growth.";
    case "workers-exceed-population":
      return "Workers exceed current population";
    case "insufficient-food":
      return `Insufficient Food. Produce and store ${validation.foodCost} Food before recruiting.`;
    case "invalid-population-state":
    case "invalid-worker-state":
    case "invalid-food-state":
      return "Recruitment state is invalid";
    case "numeric-overflow":
      return "Recruitment cannot be completed safely";
  }
}

export function validateRecruitmentPanelFoundation(): RecruitmentPanelFoundationValidationResult {
  const errors: string[] = [];
  const population = createPopulationFixture();
  const ready = createRecruitmentPanelViewModel(
    population,
    { totalWorkers: 4, availableWorkers: 1, assignedWorkers: 3 },
    { food: 10 },
  );
  const parity = createRecruitmentPanelViewModel(
    population,
    { totalWorkers: 5, availableWorkers: 2, assignedWorkers: 3 },
    { food: 20 },
  );
  const insufficientFood = createRecruitmentPanelViewModel(
    population,
    { totalWorkers: 4, availableWorkers: 1, assignedWorkers: 3 },
    { food: 9 },
  );
  const invalidState = createRecruitmentPanelViewModel(
    population,
    { totalWorkers: 4, availableWorkers: 3, assignedWorkers: 2 },
    { food: 10 },
  );

  if (
    !ready.enabled ||
    ready.recruitableWorkers !== 1 ||
    ready.buttonText !== "Recruit Worker — 10 Food" ||
    ready.reason !== "Ready to recruit"
  ) {
    errors.push("A valid recruitment must produce an enabled 10-Food button.");
  }

  if (
    parity.enabled ||
    !parity.reason.includes("Homes") ||
    insufficientFood.enabled ||
    !insufficientFood.reason.includes("10 Food") ||
    invalidState.enabled ||
    invalidState.reason !== "Recruitment state is invalid"
  ) {
    errors.push("Disabled recruitment states must expose concise reasons.");
  }

  return { valid: errors.length === 0, errors };
}

function createPopulationFixture(): PopulationState {
  return {
    currentPopulation: 5,
    populationCapacity: 6,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "supplied",
    totalSuppliedCycles: 1,
    totalUnsuppliedCycles: 0,
  };
}
