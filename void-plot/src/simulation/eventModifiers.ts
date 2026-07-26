export type ModifierAffectedSystem =
  | "power-plant-output"
  | "farm-production"
  | "forest-production";

export interface TemporaryModifier {
  readonly id: string;
  readonly label: string;
  readonly affectedSystem: ModifierAffectedSystem;
  readonly value: number;
  readonly remainingDurationMilliseconds: number;
}

export interface ModifierState {
  readonly modifiers: readonly TemporaryModifier[];
}

export interface EventModifierFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export type AdvanceModifiersResult =
  | { readonly status: "advanced"; readonly state: ModifierState; readonly expiredIds: readonly string[] }
  | { readonly status: "invalid-delta" };

export function createModifierState(): ModifierState {
  return Object.freeze({ modifiers: Object.freeze([]) });
}

export function addOrRefreshModifier(
  state: ModifierState,
  modifier: TemporaryModifier,
): ModifierState {
  const remaining = state.modifiers.filter((candidate) => candidate.id !== modifier.id);
  return Object.freeze({
    modifiers: Object.freeze([...remaining, Object.freeze({ ...modifier })]),
  });
}

export function advanceModifiers(
  state: ModifierState,
  elapsedMilliseconds: number,
): AdvanceModifiersResult {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return { status: "invalid-delta" };
  }

  const expiredIds: string[] = [];
  const modifiers = state.modifiers.flatMap((modifier) => {
    const remainingDurationMilliseconds =
      modifier.remainingDurationMilliseconds - elapsedMilliseconds;
    if (remainingDurationMilliseconds <= 0) {
      expiredIds.push(modifier.id);
      return [];
    }
    return [Object.freeze({ ...modifier, remainingDurationMilliseconds })];
  });

  return {
    status: "advanced",
    state: Object.freeze({ modifiers: Object.freeze(modifiers) }),
    expiredIds: Object.freeze(expiredIds),
  };
}

export function getPowerPlantOutputAdjustment(state: ModifierState): number {
  return sumModifierValues(state, "power-plant-output");
}

export function getFarmProductionMultiplier(state: ModifierState): number {
  return state.modifiers
    .filter((modifier) => modifier.affectedSystem === "farm-production")
    .reduce((multiplier, modifier) => multiplier * modifier.value, 1);
}

export function getForestProductionBonus(state: ModifierState): number {
  return sumModifierValues(state, "forest-production");
}

export function validateEventModifierFoundation(): EventModifierFoundationValidationResult {
  const errors: string[] = [];
  const state: ModifierState = Object.freeze({
    modifiers: Object.freeze([
      Object.freeze({ id: "power", label: "Power", affectedSystem: "power-plant-output" as const, value: -1, remainingDurationMilliseconds: 60_000 }),
      Object.freeze({ id: "farm", label: "Farm", affectedSystem: "farm-production" as const, value: 0.5, remainingDurationMilliseconds: 40_000 }),
      Object.freeze({ id: "forest", label: "Forest", affectedSystem: "forest-production" as const, value: 2, remainingDurationMilliseconds: 20_000 }),
    ]),
  });
  if (
    getPowerPlantOutputAdjustment(state) !== -1 ||
    getFarmProductionMultiplier(state) !== 0.5 ||
    getForestProductionBonus(state) !== 2
  ) {
    errors.push("Multiple modifiers must derive independent system values.");
  }
  const firstAdvance = advanceModifiers(state, 20_000);
  if (
    firstAdvance.status !== "advanced" ||
    firstAdvance.state.modifiers.some((modifier) => modifier.id === "forest") ||
    firstAdvance.expiredIds[0] !== "forest"
  ) {
    errors.push("Modifiers must expire independently at zero duration.");
  }
  const secondAdvance =
    firstAdvance.status === "advanced"
      ? advanceModifiers(firstAdvance.state, 40_000)
      : firstAdvance;
  if (secondAdvance.status !== "advanced" || secondAdvance.state.modifiers.length !== 0) {
    errors.push("All temporary modifiers must eventually expire.");
  }
  if (advanceModifiers(state, -1).status !== "invalid-delta") {
    errors.push("Invalid modifier deltas must be rejected safely.");
  }
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

function sumModifierValues(state: ModifierState, system: ModifierAffectedSystem): number {
  return state.modifiers
    .filter((modifier) => modifier.affectedSystem === system)
    .reduce((total, modifier) => total + modifier.value, 0);
}
