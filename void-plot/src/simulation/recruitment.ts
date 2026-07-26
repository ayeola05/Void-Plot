import { WORKER_RECRUITMENT_FOOD_COST } from "../data";
import { countRevealedTiles, createWorld } from "../world";
import { createBuildingState } from "./buildings";
import { createExpeditionState } from "./expedition";
import { validateFoodState, type FoodState } from "./food";
import { createMaterialsState } from "./materials";
import {
  canAssignWorkers,
  increaseTotalWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";
import {
  validatePopulationState,
  type PopulationState,
} from "./population";

export type RecruitmentFailureStatus =
  | "invalid-population-state"
  | "invalid-worker-state"
  | "invalid-food-state"
  | "worker-population-parity"
  | "workers-exceed-population"
  | "insufficient-food"
  | "numeric-overflow";

export type RecruitmentStatus =
  | "ready"
  | "recruited"
  | RecruitmentFailureStatus;

export type RecruitmentValidationResult =
  | {
      readonly canRecruit: true;
      readonly status: "ready";
      readonly foodCost: number;
      readonly recruitableWorkers: number;
    }
  | {
      readonly canRecruit: false;
      readonly status: RecruitmentFailureStatus;
      readonly foodCost: number;
      readonly recruitableWorkers: number;
    };

export type RecruitmentOperationResult =
  | {
      readonly status: "recruited";
      readonly foodCost: number;
      readonly previousFoodBalance: number;
      readonly foodState: FoodState;
      readonly workersState: WorkersState;
    }
  | {
      readonly status: RecruitmentFailureStatus;
      readonly foodCost: number;
    };

export interface RecruitmentFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly successfulExample?: Extract<
    RecruitmentOperationResult,
    { status: "recruited" }
  >;
  readonly repeatedRecruitmentCount: number;
  readonly failedOperationsWereAtomic: boolean;
  readonly sharedWorkerAvailabilityVerified: boolean;
  readonly unrelatedStateWasPreserved: boolean;
}

export function getRecruitableWorkerCount(
  populationState: PopulationState,
  workersState: WorkersState,
): number {
  if (
    !validatePopulationState(populationState).valid ||
    !validateWorkersState(workersState).valid
  ) {
    return 0;
  }

  return Math.max(
    0,
    populationState.currentPopulation - workersState.totalWorkers,
  );
}

export function validateWorkerRecruitment(
  populationState: PopulationState,
  workersState: WorkersState,
  foodState: FoodState,
  foodCost = WORKER_RECRUITMENT_FOOD_COST,
): RecruitmentValidationResult {

  if (!validatePopulationState(populationState).valid) {
    return failure("invalid-population-state", foodCost, 0);
  }

  if (!validateWorkersState(workersState).valid) {
    return failure("invalid-worker-state", foodCost, 0);
  }

  if (!validateFoodState(foodState).valid) {
    return failure(
      "invalid-food-state",
      foodCost,
      getRecruitableWorkerCount(populationState, workersState),
    );
  }

  const recruitableWorkers = getRecruitableWorkerCount(
    populationState,
    workersState,
  );

  if (workersState.totalWorkers > populationState.currentPopulation) {
    return failure("workers-exceed-population", foodCost, 0);
  }

  if (workersState.totalWorkers === populationState.currentPopulation) {
    return failure("worker-population-parity", foodCost, 0);
  }

  if (foodState.food < foodCost) {
    return failure("insufficient-food", foodCost, recruitableWorkers);
  }

  const candidateWorkers = { ...workersState };
  const increase = increaseTotalWorkers(candidateWorkers, 1);

  if (
    increase.status !== "worker-added" ||
    candidateWorkers.totalWorkers > populationState.currentPopulation ||
    !validateWorkersState(candidateWorkers).valid
  ) {
    return failure("numeric-overflow", foodCost, recruitableWorkers);
  }

  return {
    canRecruit: true,
    status: "ready",
    foodCost,
    recruitableWorkers,
  };
}

/**
 * Returns committed next states without mutating any supplied state. The Food
 * debit and worker increase are exposed together only after full validation.
 */
export function recruitWorker(
  populationState: PopulationState,
  workersState: WorkersState,
  foodState: FoodState,
  foodCost = WORKER_RECRUITMENT_FOOD_COST,
): RecruitmentOperationResult {
  const validation = validateWorkerRecruitment(
    populationState,
    workersState,
    foodState,
    foodCost,
  );

  if (validation.status !== "ready") {
    return { status: validation.status, foodCost: validation.foodCost };
  }

  const nextWorkersState = { ...workersState };
  const increase = increaseTotalWorkers(nextWorkersState, 1);

  if (increase.status !== "worker-added") {
    return { status: "numeric-overflow", foodCost: validation.foodCost };
  }

  const nextFoodState = {
    food: foodState.food - validation.foodCost,
  };

  if (!validateFoodState(nextFoodState).valid) {
    return { status: "numeric-overflow", foodCost: validation.foodCost };
  }

  return {
    status: "recruited",
    foodCost: validation.foodCost,
    previousFoodBalance: foodState.food,
    foodState: nextFoodState,
    workersState: nextWorkersState,
  };
}

function failure(
  status: RecruitmentFailureStatus,
  foodCost: number,
  recruitableWorkers: number,
): RecruitmentValidationResult {
  return {
    canRecruit: false,
    status,
    foodCost,
    recruitableWorkers,
  };
}

export function validateRecruitmentFoundation(): RecruitmentFoundationValidationResult {
  const errors: string[] = [];
  const population = createPopulationFixture(5, 6);
  const workers = { totalWorkers: 4, availableWorkers: 1, assignedWorkers: 3 };
  const food = { food: 12 };
  const populationBefore = { ...population };
  const workersBefore = { ...workers };
  const foodBefore = { ...food };
  const successfulExample = recruitWorker(population, workers, food);

  if (
    successfulExample.status !== "recruited" ||
    successfulExample.foodState.food !== 2 ||
    successfulExample.workersState.totalWorkers !== 5 ||
    successfulExample.workersState.availableWorkers !== 2 ||
    successfulExample.workersState.assignedWorkers !== 3
  ) {
    errors.push("Recruitment must spend 10 Food and add one available worker.");
  }

  if (
    !objectsMatch(population, populationBefore) ||
    !objectsMatch(workers, workersBefore) ||
    !objectsMatch(food, foodBefore)
  ) {
    errors.push("Recruitment must not mutate supplied population, workers, or Food.");
  }

  const exactFood = recruitWorker(
    population,
    { totalWorkers: 4, availableWorkers: 4, assignedWorkers: 0 },
    { food: 10 },
  );
  if (exactFood.status !== "recruited" || exactFood.foodState.food !== 0) {
    errors.push("Exactly 10 Food must permit recruitment and leave zero Food.");
  }

  const failureCases: readonly [
    RecruitmentFailureStatus,
    PopulationState,
    WorkersState,
    FoodState,
  ][] = [
    ["insufficient-food", population, workers, { food: 9 }],
    [
      "worker-population-parity",
      population,
      { totalWorkers: 5, availableWorkers: 2, assignedWorkers: 3 },
      { food: 10 },
    ],
    [
      "workers-exceed-population",
      population,
      { totalWorkers: 6, availableWorkers: 3, assignedWorkers: 3 },
      { food: 10 },
    ],
    ["invalid-food-state", population, workers, { food: NaN }],
    [
      "invalid-worker-state",
      population,
      { totalWorkers: 4, availableWorkers: 2, assignedWorkers: 3 },
      { food: 10 },
    ],
    [
      "invalid-population-state",
      { ...population, currentPopulation: 7 },
      workers,
      { food: 10 },
    ],
  ];
  let failedOperationsWereAtomic = true;

  for (const [expectedStatus, populationState, workersState, foodState] of failureCases) {
    const before = JSON.stringify({ populationState, workersState, foodState });
    const result = recruitWorker(populationState, workersState, foodState);
    const after = JSON.stringify({ populationState, workersState, foodState });

    if (result.status !== expectedStatus || before !== after) {
      failedOperationsWereAtomic = false;
      errors.push(`${expectedStatus} must fail without partial mutation.`);
    }
  }

  let repeatedPopulation = createPopulationFixture(7, 7);
  let repeatedWorkers: WorkersState = {
    totalWorkers: 4,
    availableWorkers: 4,
    assignedWorkers: 0,
  };
  let repeatedFood: FoodState = { food: 30 };
  let repeatedRecruitmentCount = 0;

  while (true) {
    const result = recruitWorker(repeatedPopulation, repeatedWorkers, repeatedFood);
    if (result.status !== "recruited") {
      if (result.status !== "worker-population-parity") {
        errors.push("Repeated recruitment must stop only at worker/population parity.");
      }
      break;
    }

    repeatedRecruitmentCount += 1;
    repeatedWorkers = result.workersState;
    repeatedFood = result.foodState;
  }

  if (
    repeatedRecruitmentCount !== 3 ||
    repeatedWorkers.totalWorkers !== 7 ||
    repeatedFood.food !== 0
  ) {
    errors.push("Repeated recruitment must safely stop at parity.");
  }

  const sharedWorkerAvailabilityVerified =
    successfulExample.status === "recruited" &&
    canAssignWorkers({ ...successfulExample.workersState }, 1).status ===
      "available" &&
    canAssignWorkers({ ...successfulExample.workersState }, 1).status ===
      "available";

  if (!sharedWorkerAvailabilityVerified) {
    errors.push("A recruited worker must be visible to shared Farm and expedition assignment.");
  }

  const materials = createMaterialsState();
  const buildings = createBuildingState();
  const world = createWorld();
  const expeditions = createExpeditionState();
  const unrelatedBefore = JSON.stringify({
    materials,
    buildings,
    revealed: countRevealedTiles(world),
    expeditions,
  });
  recruitWorker(population, workers, food);
  const unrelatedAfter = JSON.stringify({
    materials,
    buildings,
    revealed: countRevealedTiles(world),
    expeditions,
  });
  const unrelatedStateWasPreserved = unrelatedBefore === unrelatedAfter;

  if (!unrelatedStateWasPreserved) {
    errors.push("Recruitment must not modify unrelated gameplay domains.");
  }

  return {
    valid: errors.length === 0,
    errors,
    successfulExample:
      successfulExample.status === "recruited"
        ? successfulExample
        : undefined,
    repeatedRecruitmentCount,
    failedOperationsWereAtomic,
    sharedWorkerAvailabilityVerified,
    unrelatedStateWasPreserved,
  };
}

function createPopulationFixture(
  currentPopulation: number,
  populationCapacity: number,
): PopulationState {
  return {
    currentPopulation,
    populationCapacity,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "supplied",
    totalSuppliedCycles: 1,
    totalUnsuppliedCycles: 0,
  };
}

function objectsMatch(first: object, second: object): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
