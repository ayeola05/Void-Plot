import {
  DEFAULT_CURRENT_POPULATION,
  DEFAULT_POPULATION_CAPACITY,
  POPULATION_CONSUMPTION_INTERVAL_SECONDS,
  POPULATION_FOOD_PER_UNIT,
  POPULATION_GROWTH_FOOD_COST,
  POPULATION_GROWTH_INTERVAL_SECONDS,
} from "../data";
import { validateFoodState, type FoodState } from "./food";
import { countRevealedTiles, createWorld } from "../world";
import { createExpeditionState } from "./expedition";

export type PopulationSupplyStatus = "pending" | "supplied" | "unsupplied";

export interface PopulationState {
  readonly currentPopulation: number;
  readonly populationCapacity: number;
  readonly accumulatedConsumptionMilliseconds: number;
  readonly accumulatedGrowthMilliseconds: number;
  readonly latestSupplyStatus: PopulationSupplyStatus;
  readonly totalSuppliedCycles: number;
  readonly totalUnsuppliedCycles: number;
}

export type PopulationValidationResult =
  | { readonly status: "valid"; readonly valid: true }
  | { readonly status: "invalid-state"; readonly valid: false };

export type CreatePopulationStateResult =
  | { readonly status: "created"; readonly state: PopulationState }
  | { readonly status: "invalid-initial-population" };

export type IncreasePopulationCapacityResult =
  | { readonly status: "increased"; readonly state: PopulationState }
  | { readonly status: "invalid-state" }
  | { readonly status: "invalid-amount" };

export interface PopulationConsumptionEvent {
  readonly foodRequired: number;
  readonly foodConsumed: number;
  readonly population: number;
  readonly supplyStatus: "supplied" | "unsupplied";
  readonly resultingFoodBalance: number;
}

export type PopulationConsumptionResult =
  | {
      readonly status: "processed";
      readonly populationState: PopulationState;
      readonly foodState: FoodState;
      readonly events: readonly PopulationConsumptionEvent[];
    }
  | { readonly status: "invalid-state"; readonly reason: "invalid-state" }
  | { readonly status: "invalid-delta"; readonly elapsedMilliseconds: number };

export type PopulationGrowthBlockedReason =
  | "at-capacity"
  | "insufficient-food"
  | "colony-unsupplied";

export type PopulationGrowthEvent =
  | {
      readonly status: "grown";
      readonly populationBefore: number;
      readonly populationAfter: number;
      readonly foodConsumed: number;
      readonly resultingFoodBalance: number;
    }
  | {
      readonly status: "blocked";
      readonly reason: PopulationGrowthBlockedReason;
      readonly populationBefore: number;
      readonly populationAfter: number;
      readonly foodConsumed: 0;
      readonly resultingFoodBalance: number;
    };

export type PopulationGrowthResult =
  | {
      readonly status: "processed";
      readonly populationState: PopulationState;
      readonly foodState: FoodState;
      readonly events: readonly PopulationGrowthEvent[];
    }
  | { readonly status: "invalid-state"; readonly reason: "invalid-state" }
  | { readonly status: "invalid-delta"; readonly elapsedMilliseconds: number };

export type PopulationGrowthEligibility =
  | { readonly status: "eligible" }
  | { readonly status: PopulationGrowthBlockedReason }
  | { readonly status: "invalid-state" };

export type PopulationCycleResult =
  | {
      readonly status: "processed";
      readonly populationState: PopulationState;
      readonly foodState: FoodState;
      readonly consumptionEvents: readonly PopulationConsumptionEvent[];
      readonly growthEvents: readonly PopulationGrowthEvent[];
    }
  | { readonly status: "invalid-state"; readonly reason: "invalid-state" }
  | { readonly status: "invalid-delta"; readonly elapsedMilliseconds: number };

export interface PopulationFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly suppliedExample: PopulationConsumptionEvent | undefined;
  readonly shortageExample: PopulationConsumptionEvent | undefined;
  readonly growthExample: PopulationGrowthEvent | undefined;
  readonly failedOperationsWereAtomic: boolean;
}

export function createPopulationState(
  currentPopulation = DEFAULT_CURRENT_POPULATION,
  populationCapacity = DEFAULT_POPULATION_CAPACITY,
): CreatePopulationStateResult {
  const state: PopulationState = {
    currentPopulation,
    populationCapacity,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "pending",
    totalSuppliedCycles: 0,
    totalUnsuppliedCycles: 0,
  };

  return validatePopulationState(state).valid
    ? { status: "created", state: Object.freeze(state) }
    : { status: "invalid-initial-population" };
}

export function validatePopulationState(
  state: PopulationState,
): PopulationValidationResult {
  const valid =
    isNonNegativeInteger(state.currentPopulation) &&
    isNonNegativeInteger(state.populationCapacity) &&
    state.currentPopulation <= state.populationCapacity &&
    isNonNegativeFinite(state.accumulatedConsumptionMilliseconds) &&
    isNonNegativeFinite(state.accumulatedGrowthMilliseconds) &&
    (state.latestSupplyStatus === "pending" ||
      state.latestSupplyStatus === "supplied" ||
      state.latestSupplyStatus === "unsupplied") &&
    isNonNegativeInteger(state.totalSuppliedCycles) &&
    isNonNegativeInteger(state.totalUnsuppliedCycles);

  return valid
    ? { status: "valid", valid: true }
    : { status: "invalid-state", valid: false };
}

export function increasePopulationCapacity(
  state: PopulationState,
  amount: number,
): IncreasePopulationCapacityResult {
  if (!validatePopulationState(state).valid) {
    return { status: "invalid-state" };
  }

  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { status: "invalid-amount" };
  }

  const populationCapacity = state.populationCapacity + amount;

  if (!isNonNegativeInteger(populationCapacity)) {
    return { status: "invalid-amount" };
  }

  return {
    status: "increased",
    state: Object.freeze({ ...state, populationCapacity }),
  };
}

export function getPopulationGrowthEligibility(
  populationState: PopulationState,
  foodState: FoodState,
): PopulationGrowthEligibility {
  if (
    !validatePopulationState(populationState).valid ||
    !validateFoodState(foodState).valid
  ) {
    return { status: "invalid-state" };
  }

  if (populationState.currentPopulation >= populationState.populationCapacity) {
    return { status: "at-capacity" };
  }

  if (populationState.latestSupplyStatus !== "supplied") {
    return { status: "colony-unsupplied" };
  }

  if (foodState.food < POPULATION_GROWTH_FOOD_COST) {
    return { status: "insufficient-food" };
  }

  return { status: "eligible" };
}

export function processPopulationFoodConsumption(
  populationState: PopulationState,
  foodState: FoodState,
  elapsedMilliseconds: number,
  foodConsumptionMultiplier = 1,
): PopulationConsumptionResult {
  if (
    !validatePopulationState(populationState).valid ||
    !validateFoodState(foodState).valid
  ) {
    return { status: "invalid-state", reason: "invalid-state" };
  }

  if (!isValidElapsedMilliseconds(elapsedMilliseconds)) {
    return { status: "invalid-delta", elapsedMilliseconds };
  }
  if (!Number.isFinite(foodConsumptionMultiplier) || foodConsumptionMultiplier <= 0) return { status: "invalid-delta", elapsedMilliseconds };

  const accumulated =
    populationState.accumulatedConsumptionMilliseconds + elapsedMilliseconds;

  if (!Number.isFinite(accumulated)) {
    return { status: "invalid-delta", elapsedMilliseconds };
  }

  const intervalMilliseconds =
    POPULATION_CONSUMPTION_INTERVAL_SECONDS * 1_000;
  const completedIntervals = Math.floor(accumulated / intervalMilliseconds);
  let foodBalance = foodState.food;
  let latestSupplyStatus = populationState.latestSupplyStatus;
  let totalSuppliedCycles = populationState.totalSuppliedCycles;
  let totalUnsuppliedCycles = populationState.totalUnsuppliedCycles;
  const events: PopulationConsumptionEvent[] = [];

  for (let index = 0; index < completedIntervals; index += 1) {
    const foodRequired = Math.ceil(
      populationState.currentPopulation * POPULATION_FOOD_PER_UNIT * foodConsumptionMultiplier,
    );
    const supplied = foodBalance >= foodRequired;
    const foodConsumed = supplied ? foodRequired : 0;

    foodBalance -= foodConsumed;
    latestSupplyStatus = supplied ? "supplied" : "unsupplied";
    totalSuppliedCycles += supplied ? 1 : 0;
    totalUnsuppliedCycles += supplied ? 0 : 1;
    events.push(
      Object.freeze({
        foodRequired,
        foodConsumed,
        population: populationState.currentPopulation,
        supplyStatus: latestSupplyStatus,
        resultingFoodBalance: foodBalance,
      }),
    );
  }

  return {
    status: "processed",
    populationState: Object.freeze({
      ...populationState,
      accumulatedConsumptionMilliseconds:
        accumulated - completedIntervals * intervalMilliseconds,
      latestSupplyStatus,
      totalSuppliedCycles,
      totalUnsuppliedCycles,
    }),
    foodState: { food: foodBalance },
    events: Object.freeze(events),
  };
}

export function processPopulationGrowth(
  populationState: PopulationState,
  foodState: FoodState,
  elapsedMilliseconds: number,
  intervalMultiplier = 1,
): PopulationGrowthResult {
  if (
    !validatePopulationState(populationState).valid ||
    !validateFoodState(foodState).valid
  ) {
    return { status: "invalid-state", reason: "invalid-state" };
  }

  if (!isValidElapsedMilliseconds(elapsedMilliseconds)) {
    return { status: "invalid-delta", elapsedMilliseconds };
  }

  if (!Number.isFinite(intervalMultiplier) || intervalMultiplier <= 0) {
    return { status: "invalid-delta", elapsedMilliseconds };
  }

  const accumulated =
    populationState.accumulatedGrowthMilliseconds + elapsedMilliseconds;

  if (!Number.isFinite(accumulated)) {
    return { status: "invalid-delta", elapsedMilliseconds };
  }

  const intervalMilliseconds = POPULATION_GROWTH_INTERVAL_SECONDS * 1_000 * intervalMultiplier;
  const completedIntervals = Math.floor(accumulated / intervalMilliseconds);
  let currentPopulation = populationState.currentPopulation;
  let foodBalance = foodState.food;
  const events: PopulationGrowthEvent[] = [];

  for (let index = 0; index < completedIntervals; index += 1) {
    const cycleState: PopulationState = {
      ...populationState,
      currentPopulation,
    };
    const eligibility = getPopulationGrowthEligibility(cycleState, {
      food: foodBalance,
    });

    if (eligibility.status === "eligible") {
      const populationBefore = currentPopulation;
      currentPopulation += 1;
      foodBalance -= POPULATION_GROWTH_FOOD_COST;
      events.push(
        Object.freeze({
          status: "grown",
          populationBefore,
          populationAfter: currentPopulation,
          foodConsumed: POPULATION_GROWTH_FOOD_COST,
          resultingFoodBalance: foodBalance,
        }),
      );
      continue;
    }

    if (eligibility.status === "invalid-state") {
      return { status: "invalid-state", reason: "invalid-state" };
    }

    events.push(
      Object.freeze({
        status: "blocked",
        reason: eligibility.status,
        populationBefore: currentPopulation,
        populationAfter: currentPopulation,
        foodConsumed: 0,
        resultingFoodBalance: foodBalance,
      }),
    );
  }

  return {
    status: "processed",
    populationState: Object.freeze({
      ...populationState,
      currentPopulation,
      accumulatedGrowthMilliseconds:
        accumulated - completedIntervals * intervalMilliseconds,
    }),
    foodState: { food: foodBalance },
    events: Object.freeze(events),
  };
}

/** Applies consumption before growth using the same elapsed scene delta. */
export function advancePopulationCycles(
  populationState: PopulationState,
  foodState: FoodState,
  elapsedMilliseconds: number,
  growthIntervalMultiplier = 1,
  foodConsumptionMultiplier = 1,
): PopulationCycleResult {
  const consumption = processPopulationFoodConsumption(
    populationState,
    foodState,
    elapsedMilliseconds,
    foodConsumptionMultiplier,
  );

  if (consumption.status !== "processed") {
    return consumption;
  }

  const growth = processPopulationGrowth(
    consumption.populationState,
    consumption.foodState,
    elapsedMilliseconds,
    growthIntervalMultiplier,
  );

  if (growth.status !== "processed") {
    return growth;
  }

  return {
    status: "processed",
    populationState: growth.populationState,
    foodState: growth.foodState,
    consumptionEvents: consumption.events,
    growthEvents: growth.events,
  };
}

export function validatePopulationFoundation(): PopulationFoundationValidationResult {
  const errors: string[] = [];
  const initial = createPopulationState();

  if (
    initial.status !== "created" ||
    initial.state.currentPopulation !== 4 ||
    initial.state.populationCapacity !== 4
  ) {
    errors.push("Population must begin at 4 of 4 capacity.");
  }

  const suppliedState = createPopulationState(4, 6);
  if (suppliedState.status !== "created") {
    throw new Error("Population validation fixture must be valid.");
  }

  const beforeConsumption = processPopulationFoodConsumption(
    suppliedState.state,
    { food: 10 },
    19_999,
  );
  if (
    beforeConsumption.status !== "processed" ||
    beforeConsumption.events.length !== 0 ||
    beforeConsumption.foodState.food !== 10
  ) {
    errors.push("Food must not be consumed before 20 seconds.");
  }

  const supplied = processPopulationFoodConsumption(
    suppliedState.state,
    { food: 10 },
    20_000,
  );
  const suppliedExample =
    supplied.status === "processed" ? supplied.events[0] : undefined;
  if (
    suppliedExample?.supplyStatus !== "supplied" ||
    suppliedExample.foodConsumed !== 4 ||
    suppliedExample.resultingFoodBalance !== 6
  ) {
    errors.push("A supplied cycle must atomically consume Food for all population.");
  }

  const shortage = processPopulationFoodConsumption(
    suppliedState.state,
    { food: 3 },
    20_000,
  );
  const shortageExample =
    shortage.status === "processed" ? shortage.events[0] : undefined;
  if (
    shortageExample?.supplyStatus !== "unsupplied" ||
    shortageExample.foodConsumed !== 0 ||
    shortageExample.resultingFoodBalance !== 3
  ) {
    errors.push("A shortage must consume no partial Food.");
  }

  const delayedConsumption = processPopulationFoodConsumption(
    suppliedState.state,
    { food: 10 },
    60_000,
  );
  if (
    delayedConsumption.status !== "processed" ||
    delayedConsumption.events.length !== 3 ||
    delayedConsumption.foodState.food !== 2 ||
    delayedConsumption.events[2].supplyStatus !== "unsupplied"
  ) {
    errors.push("Delayed consumption must process every complete interval safely.");
  }

  const suppliedForGrowth: PopulationState = {
    ...suppliedState.state,
    latestSupplyStatus: "supplied",
  };
  const beforeGrowth = processPopulationGrowth(
    suppliedForGrowth,
    { food: 6 },
    29_999,
  );
  if (
    beforeGrowth.status !== "processed" ||
    beforeGrowth.events.length !== 0 ||
    beforeGrowth.populationState.currentPopulation !== 4
  ) {
    errors.push("Population must not grow before 30 seconds.");
  }

  const growth = processPopulationGrowth(
    suppliedForGrowth,
    { food: 6 },
    30_000,
  );
  const growthExample =
    growth.status === "processed" ? growth.events[0] : undefined;
  if (
    growthExample?.status !== "grown" ||
    growthExample.populationAfter !== 5 ||
    growthExample.foodConsumed !== 2 ||
    growthExample.resultingFoodBalance !== 4
  ) {
    errors.push("A successful growth cycle must spend 2 Food and add one population.");
  }

  const atCapacity = processPopulationGrowth(
    { ...suppliedForGrowth, populationCapacity: 4 },
    { food: 10 },
    30_000,
  );
  const unsupplied = processPopulationGrowth(
    { ...suppliedForGrowth, latestSupplyStatus: "unsupplied" },
    { food: 10 },
    30_000,
  );
  const insufficient = processPopulationGrowth(
    suppliedForGrowth,
    { food: 1 },
    30_000,
  );

  if (
    atCapacity.status !== "processed" ||
    atCapacity.events[0]?.status !== "blocked" ||
    atCapacity.events[0].reason !== "at-capacity" ||
    unsupplied.status !== "processed" ||
    unsupplied.events[0]?.status !== "blocked" ||
    unsupplied.events[0].reason !== "colony-unsupplied" ||
    insufficient.status !== "processed" ||
    insufficient.events[0]?.status !== "blocked" ||
    insufficient.events[0].reason !== "insufficient-food"
  ) {
    errors.push("Growth blocks must report capacity, supply, and Food reasons.");
  }

  const delayedGrowth = processPopulationGrowth(
    { ...suppliedForGrowth, populationCapacity: 8 },
    { food: 10 },
    120_000,
  );
  if (
    delayedGrowth.status !== "processed" ||
    delayedGrowth.events.length !== 4 ||
    delayedGrowth.populationState.currentPopulation !== 8 ||
    delayedGrowth.foodState.food !== 2
  ) {
    errors.push("Delayed growth must process once per interval without exceeding capacity.");
  }

  const ordered = advancePopulationCycles(
    {
      ...suppliedState.state,
      accumulatedConsumptionMilliseconds: 10_000,
      accumulatedGrowthMilliseconds: 20_000,
    },
    { food: 6 },
    10_000,
  );
  if (
    ordered.status !== "processed" ||
    ordered.consumptionEvents[0]?.supplyStatus !== "supplied" ||
    ordered.growthEvents[0]?.status !== "grown" ||
    ordered.populationState.currentPopulation !== 5 ||
    ordered.foodState.food !== 0
  ) {
    errors.push("Population cycles must deterministically process consumption before growth.");
  }

  const invalidPopulation = {
    ...suppliedState.state,
    currentPopulation: 7,
    populationCapacity: 6,
  };
  const populationSnapshot = JSON.stringify(invalidPopulation);
  const foodSnapshot = JSON.stringify({ food: 10 });
  const invalidFood = { food: 10 };
  const invalidResult = advancePopulationCycles(
    invalidPopulation,
    invalidFood,
    30_000,
  );
  const failedOperationsWereAtomic =
    invalidResult.status === "invalid-state" &&
    JSON.stringify(invalidPopulation) === populationSnapshot &&
    JSON.stringify(invalidFood) === foodSnapshot;

  const invalidDeltaPopulationSnapshot = JSON.stringify(suppliedState.state);
  const invalidDeltaFood = { food: 10 };
  const invalidDeltaFoodSnapshot = JSON.stringify(invalidDeltaFood);
  const invalidDelta = advancePopulationCycles(
    suppliedState.state,
    invalidDeltaFood,
    -1,
  );

  if (
    invalidDelta.status !== "invalid-delta" ||
    JSON.stringify(suppliedState.state) !== invalidDeltaPopulationSnapshot ||
    JSON.stringify(invalidDeltaFood) !== invalidDeltaFoodSnapshot
  ) {
    errors.push("Invalid elapsed time must preserve population and Food state.");
  }

  const isolationWorld = createWorld();
  const isolationExpedition = createExpeditionState();
  const isolationWorkers = {
    totalWorkers: 4,
    availableWorkers: 3,
    assignedWorkers: 1,
  };
  const isolationMaterials = { materials: 170 };
  const isolationBuildings = {
    buildings: [{ id: "isolation-home", type: "homes" }],
  };
  const isolationSnapshot = JSON.stringify({
    isolationExpedition,
    isolationWorkers,
    isolationMaterials,
    isolationBuildings,
  });
  const revealedBefore = countRevealedTiles(isolationWorld);

  advancePopulationCycles(suppliedForGrowth, { food: 6 }, 30_000);

  if (
    countRevealedTiles(isolationWorld) !== revealedBefore ||
    JSON.stringify({
      isolationExpedition,
      isolationWorkers,
      isolationMaterials,
      isolationBuildings,
    }) !== isolationSnapshot
  ) {
    errors.push(
      "Population cycles must not mutate workers, materials, buildings, world, or expeditions.",
    );
  }

  if (!failedOperationsWereAtomic) {
    errors.push("Invalid population processing must preserve supplied states.");
  }

  return {
    valid: errors.length === 0,
    errors,
    suppliedExample,
    shortageExample,
    growthExample,
    failedOperationsWereAtomic,
  };
}

function isValidElapsedMilliseconds(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
