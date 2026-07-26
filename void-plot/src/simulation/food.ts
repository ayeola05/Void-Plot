import { DEFAULT_INITIAL_FOOD } from "../data";

export type FoodAmount = number;

export interface FoodState {
  food: FoodAmount;
}

export type CreateFoodStateResult =
  | { readonly status: "created"; readonly state: FoodState }
  | { readonly status: "invalid-initial-food"; readonly initialFood: number };

export type FoodValidationResult =
  | { readonly valid: true; readonly status: "valid" }
  | { readonly valid: false; readonly status: "invalid-state" };

export type FoodCreditResult =
  | {
      readonly status: "added";
      readonly amount: FoodAmount;
      readonly previousBalance: FoodAmount;
      readonly balance: FoodAmount;
    }
  | { readonly status: "invalid-amount"; readonly amount: number }
  | { readonly status: "invalid-state" };

export interface FoodFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function createFoodState(
  initialFood: number = DEFAULT_INITIAL_FOOD,
): CreateFoodStateResult {
  if (!isNonNegativeInteger(initialFood)) {
    return { status: "invalid-initial-food", initialFood };
  }

  return { status: "created", state: { food: initialFood } };
}

export function validateFoodState(state: FoodState): FoodValidationResult {
  return isNonNegativeInteger(state.food)
    ? { valid: true, status: "valid" }
    : { valid: false, status: "invalid-state" };
}

export function getFoodBalance(state: FoodState): FoodAmount {
  return state.food;
}

/** Mutates `state` only when the returned status is `added`. */
export function addFood(state: FoodState, amount: number): FoodCreditResult {
  if (!validateFoodState(state).valid) {
    return { status: "invalid-state" };
  }

  if (!isPositiveInteger(amount)) {
    return { status: "invalid-amount", amount };
  }

  const balance = state.food + amount;

  if (!isNonNegativeInteger(balance)) {
    return { status: "invalid-amount", amount };
  }

  const previousBalance = state.food;
  state.food = balance;
  return { status: "added", amount, previousBalance, balance };
}

export function validateFoodFoundation(): FoodFoundationValidationResult {
  const errors: string[] = [];
  const initial = createFoodState();

  if (initial.status !== "created" || initial.state.food !== DEFAULT_INITIAL_FOOD) {
    errors.push(`Food must start at the configured ${DEFAULT_INITIAL_FOOD}.`);
  }

  for (const invalid of [-1, 1.5, NaN, Infinity]) {
    if (createFoodState(invalid).status !== "invalid-initial-food") {
      errors.push(`Invalid initial Food value ${invalid} was accepted.`);
    }
  }

  const state = { food: 0 };
  if (addFood(state, 3).status !== "added" || state.food !== 3) {
    errors.push("Valid Food crediting failed.");
  }

  const before = state.food;
  if (addFood(state, 0).status !== "invalid-amount" || state.food !== before) {
    errors.push("Invalid Food crediting must not mutate state.");
  }

  return { valid: errors.length === 0, errors };
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
