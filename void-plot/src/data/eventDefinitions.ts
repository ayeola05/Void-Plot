export const EVENT_MIN_DELAY_SECONDS = 90;
export const EVENT_MAX_DELAY_SECONDS = 150;
export const TEMPORARY_EVENT_DURATION_SECONDS = 60;

export type EventId =
  | "supply-cache"
  | "wandering-survivors"
  | "generator-maintenance"
  | "crop-blight"
  | "rich-forest"
  | "festival";

export type EventChoiceEffect =
  | { readonly type: "add-food"; readonly amount: number }
  | { readonly type: "add-materials"; readonly amount: number }
  | { readonly type: "spend-food"; readonly amount: number }
  | { readonly type: "spend-materials"; readonly amount: number }
  | { readonly type: "add-population"; readonly amount: number }
  | { readonly type: "mark-colony-supplied" }
  | {
      readonly type: "add-modifier";
      readonly modifierId: string;
      readonly label: string;
      readonly affectedSystem:
        | "power-plant-output"
        | "farm-production"
        | "forest-production";
      readonly value: number;
      readonly durationSeconds: number;
    }
  | { readonly type: "none" };

export interface EventChoiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly effects: readonly EventChoiceEffect[];
}

export interface EventDefinition {
  readonly id: EventId;
  readonly title: string;
  readonly description: string;
  readonly temporaryEffectDurationSeconds?: number;
  readonly choices: readonly EventChoiceDefinition[];
}

const freezeEffects = (effects: readonly EventChoiceEffect[]) =>
  Object.freeze(effects);
const freezeChoices = (choices: readonly EventChoiceDefinition[]) =>
  Object.freeze(choices);

export const EVENT_DEFINITIONS = Object.freeze([
  {
    id: "supply-cache",
    title: "Supply Cache",
    description: "A sealed cache lies just beyond the perimeter.",
    choices: freezeChoices([
      { id: "take-food", label: "Take Food (+20)", effects: freezeEffects([{ type: "add-food", amount: 20 }]) },
      { id: "take-materials", label: "Take Materials (+25)", effects: freezeEffects([{ type: "add-materials", amount: 25 }]) },
      { id: "leave-it", label: "Leave It", effects: freezeEffects([{ type: "none" }]) },
    ]),
  },
  {
    id: "wandering-survivors",
    title: "Wandering Survivors",
    description: "Exhausted survivors ask for shelter inside the plot.",
    choices: freezeChoices([
      { id: "accept", label: "Accept (+1 Population)", effects: freezeEffects([{ type: "add-population", amount: 1 }]) },
      { id: "turn-away", label: "Turn Them Away", effects: freezeEffects([{ type: "none" }]) },
    ]),
  },
  {
    id: "generator-maintenance",
    title: "Generator Maintenance",
    description: "Power-plant components are nearing failure.",
    temporaryEffectDurationSeconds: TEMPORARY_EVENT_DURATION_SECONDS,
    choices: freezeChoices([
      { id: "repair-now", label: "Repair Now (-20 Materials)", effects: freezeEffects([{ type: "spend-materials", amount: 20 }]) },
      {
        id: "delay-repair",
        label: "Delay Repair (-1 Power / Plant, 60s)",
        effects: freezeEffects([{ type: "add-modifier", modifierId: "generator-maintenance", label: "Generator Repair", affectedSystem: "power-plant-output", value: -1, durationSeconds: TEMPORARY_EVENT_DURATION_SECONDS }]),
      },
    ]),
  },
  {
    id: "crop-blight",
    title: "Crop Blight",
    description: "A grey rot is spreading through cultivated soil.",
    temporaryEffectDurationSeconds: TEMPORARY_EVENT_DURATION_SECONDS,
    choices: freezeChoices([
      { id: "treat-crops", label: "Treat Crops (-15 Materials)", effects: freezeEffects([{ type: "spend-materials", amount: 15 }]) },
      {
        id: "do-nothing",
        label: "Do Nothing (-50% Farm, 60s)",
        effects: freezeEffects([{ type: "add-modifier", modifierId: "crop-blight", label: "Crop Blight", affectedSystem: "farm-production", value: 0.5, durationSeconds: TEMPORARY_EVENT_DURATION_SECONDS }]),
      },
    ]),
  },
  {
    id: "rich-forest",
    title: "Rich Forest",
    description: "A burst of dense growth makes every forest unusually productive.",
    temporaryEffectDurationSeconds: TEMPORARY_EVENT_DURATION_SECONDS,
    choices: freezeChoices([
      {
        id: "harvest",
        label: "Harvest (+2 Materials / Forest, 60s)",
        effects: freezeEffects([{ type: "add-modifier", modifierId: "rich-forest", label: "Rich Forest", affectedSystem: "forest-production", value: 2, durationSeconds: TEMPORARY_EVENT_DURATION_SECONDS }]),
      },
      { id: "ignore", label: "Ignore", effects: freezeEffects([{ type: "none" }]) },
    ]),
  },
  {
    id: "festival",
    title: "Festival",
    description: "The colony asks for one evening of warmth and shared food.",
    choices: freezeChoices([
      { id: "celebrate", label: "Celebrate (-10 Food)", effects: freezeEffects([{ type: "spend-food", amount: 10 }, { type: "mark-colony-supplied" }]) },
      { id: "keep-working", label: "Keep Working", effects: freezeEffects([{ type: "none" }]) },
    ]),
  },
] satisfies readonly EventDefinition[]);

export function getEventDefinition(eventId: EventId): EventDefinition | undefined {
  return EVENT_DEFINITIONS.find((event) => event.id === eventId);
}
