export const BEACON_PHASE_DURATION_SECONDS = 300;

export type BeaconPhase =
  | "dormant"
  | "awakening"
  | "signal"
  | "overload"
  | "final-transmission";

export interface BeaconPhaseDefinition {
  readonly phase: BeaconPhase;
  readonly number: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
}

export const BEACON_PHASES: readonly BeaconPhaseDefinition[] = Object.freeze([
  Object.freeze({ phase: "dormant", number: 1, label: "Dormant" }),
  Object.freeze({ phase: "awakening", number: 2, label: "Awakening" }),
  Object.freeze({ phase: "signal", number: 3, label: "Signal" }),
  Object.freeze({ phase: "overload", number: 4, label: "Overload" }),
  Object.freeze({ phase: "final-transmission", number: 5, label: "Final Transmission" }),
]);

export const BEACON_VICTORY_REQUIREMENTS = Object.freeze({
  population: 20,
  materials: 300,
  food: 250,
  powerGeneration: 12,
});
