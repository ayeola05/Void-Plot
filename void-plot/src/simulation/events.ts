import {
  EVENT_DEFINITIONS,
  EVENT_MAX_DELAY_SECONDS,
  EVENT_MIN_DELAY_SECONDS,
  getEventDefinition,
  type EventChoiceDefinition,
  type EventDefinition,
  type EventId,
} from "../data/eventDefinitions";
import { addFood, validateFoodState, type FoodState } from "./food";
import {
  addMaterials,
  validateMaterialsState,
  type MaterialsState,
} from "./materials";
import { validatePopulationState, type PopulationState } from "./population";
import {
  addOrRefreshModifier,
  createModifierState,
  type ModifierState,
} from "./eventModifiers";

export interface DynamicEventState {
  readonly elapsedSinceLastEventMilliseconds: number;
  readonly nextEventDelayMilliseconds: number;
  readonly activeEventId?: EventId;
  readonly nextEventIndex: number;
}

export interface EventGameplayState {
  readonly events: DynamicEventState;
  readonly modifiers: ModifierState;
  readonly food: FoodState;
  readonly materials: MaterialsState;
  readonly population: PopulationState;
}

export type EventChoiceAvailability =
  | { readonly status: "available" }
  | { readonly status: "insufficient-food"; readonly required: number }
  | { readonly status: "insufficient-materials"; readonly required: number }
  | { readonly status: "population-at-capacity" }
  | { readonly status: "invalid-state" };

export type AdvanceEventTimingResult =
  | { readonly status: "advanced"; readonly state: DynamicEventState }
  | { readonly status: "event-opened"; readonly state: DynamicEventState; readonly event: EventDefinition }
  | { readonly status: "event-already-active"; readonly state: DynamicEventState }
  | { readonly status: "invalid-delta"; readonly state: DynamicEventState };

export type ResolveEventChoiceResult =
  | {
      readonly status: "resolved";
      readonly choice: EventChoiceDefinition;
      readonly state: EventGameplayState;
    }
  | { readonly status: "no-active-event" }
  | { readonly status: "choice-not-found" }
  | { readonly status: Exclude<EventChoiceAvailability["status"], "available"> };

export interface EventSystemValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function createDynamicEventState(randomValue = Math.random()): DynamicEventState {
  return Object.freeze({
    elapsedSinceLastEventMilliseconds: 0,
    nextEventDelayMilliseconds: calculateNextEventDelayMilliseconds(randomValue),
    nextEventIndex: 0,
  });
}

export function calculateNextEventDelayMilliseconds(randomValue: number): number {
  const safeRandom = Number.isFinite(randomValue)
    ? Math.min(1, Math.max(0, randomValue))
    : 0;
  const rangeSeconds = EVENT_MAX_DELAY_SECONDS - EVENT_MIN_DELAY_SECONDS;
  return Math.round((EVENT_MIN_DELAY_SECONDS + rangeSeconds * safeRandom) * 1_000);
}

export function getActiveEvent(state: DynamicEventState): EventDefinition | undefined {
  return state.activeEventId === undefined
    ? undefined
    : getEventDefinition(state.activeEventId);
}

export function advanceEventTiming(
  state: DynamicEventState,
  elapsedMilliseconds: number,
): AdvanceEventTimingResult {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return { status: "invalid-delta", state };
  }
  if (state.activeEventId !== undefined) {
    return { status: "event-already-active", state };
  }

  const elapsedSinceLastEventMilliseconds =
    state.elapsedSinceLastEventMilliseconds + elapsedMilliseconds;
  if (elapsedSinceLastEventMilliseconds < state.nextEventDelayMilliseconds) {
    return {
      status: "advanced",
      state: Object.freeze({ ...state, elapsedSinceLastEventMilliseconds }),
    };
  }

  const event = EVENT_DEFINITIONS[state.nextEventIndex % EVENT_DEFINITIONS.length];
  return {
    status: "event-opened",
    event,
    state: Object.freeze({
      ...state,
      elapsedSinceLastEventMilliseconds: state.nextEventDelayMilliseconds,
      activeEventId: event.id,
      nextEventIndex: (state.nextEventIndex + 1) % EVENT_DEFINITIONS.length,
    }),
  };
}

export function validateEventChoice(
  choice: EventChoiceDefinition,
  gameplay: Omit<EventGameplayState, "events">,
): EventChoiceAvailability {
  if (
    !validateFoodState(gameplay.food).valid ||
    !validateMaterialsState(gameplay.materials).valid ||
    !validatePopulationState(gameplay.population).valid
  ) {
    return { status: "invalid-state" };
  }

  for (const effect of choice.effects) {
    if (effect.type === "spend-food" && gameplay.food.food < effect.amount) {
      return { status: "insufficient-food", required: effect.amount };
    }
    if (
      effect.type === "spend-materials" &&
      gameplay.materials.materials < effect.amount
    ) {
      return { status: "insufficient-materials", required: effect.amount };
    }
    if (
      effect.type === "add-population" &&
      gameplay.population.currentPopulation + effect.amount >
        gameplay.population.populationCapacity
    ) {
      return { status: "population-at-capacity" };
    }
  }
  return { status: "available" };
}

export function resolveEventChoice(
  gameplay: EventGameplayState,
  choiceId: string,
  nextDelayRandomValue = Math.random(),
): ResolveEventChoiceResult {
  const event = getActiveEvent(gameplay.events);
  if (event === undefined) {
    return { status: "no-active-event" };
  }
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) {
    return { status: "choice-not-found" };
  }

  const availability = validateEventChoice(choice, gameplay);
  if (availability.status !== "available") {
    return { status: availability.status };
  }

  const food = { ...gameplay.food };
  const materials = { ...gameplay.materials };
  let population: PopulationState = Object.freeze({ ...gameplay.population });
  let modifiers = gameplay.modifiers;

  for (const effect of choice.effects) {
    switch (effect.type) {
      case "add-food":
        if (addFood(food, effect.amount).status !== "added") return { status: "invalid-state" };
        break;
      case "add-materials":
        if (addMaterials(materials, effect.amount).status !== "added") return { status: "invalid-state" };
        break;
      case "spend-food":
        food.food -= effect.amount;
        break;
      case "spend-materials":
        materials.materials -= effect.amount;
        break;
      case "add-population":
        population = Object.freeze({
          ...population,
          currentPopulation: population.currentPopulation + effect.amount,
        });
        break;
      case "mark-colony-supplied":
        population = Object.freeze({ ...population, latestSupplyStatus: "supplied" });
        break;
      case "add-modifier":
        modifiers = addOrRefreshModifier(modifiers, {
          id: effect.modifierId,
          label: effect.label,
          affectedSystem: effect.affectedSystem,
          value: effect.value,
          remainingDurationMilliseconds: effect.durationSeconds * 1_000,
        });
        break;
      case "none":
        break;
    }
  }

  const events = Object.freeze({
    ...gameplay.events,
    activeEventId: undefined,
    elapsedSinceLastEventMilliseconds: 0,
    nextEventDelayMilliseconds: calculateNextEventDelayMilliseconds(nextDelayRandomValue),
  });
  return {
    status: "resolved",
    choice,
    state: Object.freeze({ events, modifiers, food, materials, population }),
  };
}

export function validateEventSystemFoundation(): EventSystemValidationResult {
  const errors: string[] = [];
  const basePopulation: PopulationState = Object.freeze({
    currentPopulation: 1,
    populationCapacity: 4,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "pending",
    totalSuppliedCycles: 0,
    totalUnsuppliedCycles: 0,
  });
  const base = (): EventGameplayState => ({
    events: createDynamicEventState(0),
    modifiers: createModifierState(),
    food: { food: 20 },
    materials: { materials: 30 },
    population: basePopulation,
  });
  const active = (eventId: EventId): EventGameplayState => {
    const state = base();
    return { ...state, events: Object.freeze({ ...state.events, activeEventId: eventId }) };
  };

  if (calculateNextEventDelayMilliseconds(0) !== 90_000 || calculateNextEventDelayMilliseconds(1) !== 150_000) {
    errors.push("Event delay boundaries must be 90–150 seconds.");
  }
  let timing = createDynamicEventState(0);
  const before = advanceEventTiming(timing, 89_999);
  if (before.status !== "advanced") errors.push("Events must not open before their delay.");
  timing = before.state;
  const opened = advanceEventTiming(timing, 1);
  if (opened.status !== "event-opened") errors.push("An event must open at its delay.");
  else if (advanceEventTiming(opened.state, 999_999).status !== "event-already-active") errors.push("Only one event may be active.");

  const supplyState = active("supply-cache");
  const reward = resolveEventChoice(supplyState, "take-food", 0);
  if (reward.status !== "resolved" || reward.state.food.food !== 40) errors.push("Supply Cache Food reward failed.");
  const materialsReward = resolveEventChoice(active("supply-cache"), "take-materials", 0);
  if (materialsReward.status !== "resolved" || materialsReward.state.materials.materials !== 55) errors.push("Supply Cache Materials reward failed.");
  const survivors = resolveEventChoice(active("wandering-survivors"), "accept", 0);
  if (survivors.status !== "resolved" || survivors.state.population.currentPopulation !== 2) errors.push("Wandering Survivors consequence failed.");
  const repair = resolveEventChoice(active("generator-maintenance"), "repair-now", 0);
  const delayRepair = resolveEventChoice(active("generator-maintenance"), "delay-repair", 0);
  if (repair.status !== "resolved" || repair.state.materials.materials !== 10 || delayRepair.status !== "resolved" || delayRepair.state.modifiers.modifiers[0]?.value !== -1) errors.push("Generator Maintenance consequences failed.");
  const cropTreatment = resolveEventChoice(active("crop-blight"), "treat-crops", 0);
  if (cropTreatment.status !== "resolved" || cropTreatment.state.materials.materials !== 15) errors.push("Crop treatment consequence failed.");
  const richForest = resolveEventChoice(active("rich-forest"), "harvest", 0);
  if (richForest.status !== "resolved" || richForest.state.modifiers.modifiers[0]?.value !== 2) errors.push("Rich Forest consequence failed.");
  const festivalState = active("festival");
  const festival = resolveEventChoice(festivalState, "celebrate", 0);
  if (festival.status !== "resolved" || festival.state.food.food !== 10 || festival.state.population.latestSupplyStatus !== "supplied") errors.push("Festival consequence failed.");
  const blightState = { ...base(), events: Object.freeze({ ...base().events, activeEventId: "crop-blight" as const }) };
  const blight = resolveEventChoice(blightState, "do-nothing", 0);
  if (blight.status !== "resolved" || blight.state.modifiers.modifiers[0]?.remainingDurationMilliseconds !== 60_000) errors.push("Temporary modifier application failed.");

  const poor = { ...festivalState, food: { food: 0 } };
  const poorSnapshot = JSON.stringify(poor);
  if (resolveEventChoice(poor, "celebrate", 0).status !== "insufficient-food" || JSON.stringify(poor) !== poorSnapshot) errors.push("Failed choices must be atomic.");
  if (EVENT_DEFINITIONS.length !== 6) errors.push("The initial catalog must contain six events.");
  const noEffectBefore = active("supply-cache");
  const noEffect = resolveEventChoice(noEffectBefore, "leave-it", 1);
  if (
    noEffect.status !== "resolved" ||
    noEffect.state.food.food !== noEffectBefore.food.food ||
    noEffect.state.materials.materials !== noEffectBefore.materials.materials ||
    noEffect.state.events.nextEventDelayMilliseconds !== 150_000
  ) {
    errors.push("No-effect choices must preserve colony state and schedule a new delay.");
  }

  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}
