import {
  BEACON_PHASE_DURATION_SECONDS,
  BEACON_PHASES,
  BEACON_VICTORY_REQUIREMENTS,
  TECHNOLOGY_DEFINITIONS,
  type BeaconPhase,
  type TechnologyId,
} from "../data";

export type BeaconFailureRisk = "low" | "medium" | "high" | "critical";

export interface BeaconModifiers {
  readonly populationFoodConsumptionMultiplier: number;
  readonly farmProductionMultiplier: number;
  readonly forestProductionMultiplier: number;
  readonly staffedProductionPowerDemandAddition: number;
  readonly powerPlantOutputAdjustment: number;
}

export interface BeaconRequirementProgress {
  readonly population: { readonly current: number; readonly required: number; readonly progress: number; readonly met: boolean };
  readonly food: { readonly current: number; readonly required: number; readonly progress: number; readonly met: boolean };
  readonly materials: { readonly current: number; readonly required: number; readonly progress: number; readonly met: boolean };
  readonly power: { readonly current: number; readonly required: number; readonly progress: number; readonly met: boolean };
  readonly research: { readonly current: number; readonly required: number; readonly progress: number; readonly met: boolean };
}

export type BeaconVictoryAvailability =
  | { readonly status: "available" }
  | { readonly status: "wrong-phase" }
  | { readonly status: "requirements-not-met" }
  | { readonly status: "already-activated" };

export interface BeaconDerivationContext {
  readonly population: number;
  readonly food: number;
  readonly materials: number;
  readonly powerGeneration: number;
  readonly powerShortage: boolean;
  readonly latestPopulationSupplied: boolean;
  readonly totalUnsuppliedCycles: number;
  readonly completedTechnologies: readonly TechnologyId[];
}

export interface BeaconState {
  readonly currentPhase: BeaconPhase;
  readonly phaseNumber: 1 | 2 | 3 | 4 | 5;
  readonly elapsedPhaseMilliseconds: number;
  readonly elapsedRunMilliseconds: number;
  readonly nextPhaseCountdownMilliseconds: number;
  readonly modifiers: BeaconModifiers;
  readonly requirements: BeaconRequirementProgress;
  readonly victoryAvailability: BeaconVictoryAvailability;
  readonly failureRisk: BeaconFailureRisk;
  readonly victoryAchieved: boolean;
  readonly validationStatus: "valid";
}

const EMPTY_CONTEXT: BeaconDerivationContext = Object.freeze({ population: 0, food: 0, materials: 0, powerGeneration: 0, powerShortage: false, latestPopulationSupplied: true, totalUnsuppliedCycles: 0, completedTechnologies: Object.freeze([]) });

export function createBeaconState(context: BeaconDerivationContext = EMPTY_CONTEXT): BeaconState {
  return deriveBeaconState({ phaseIndex: 0, elapsedPhaseMilliseconds: 0, elapsedRunMilliseconds: 0, victoryAchieved: false }, context);
}

export function advanceBeaconProgression(state: BeaconState, elapsedMilliseconds: number, context: BeaconDerivationContext): BeaconState | undefined {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0 || state.validationStatus !== "valid") return undefined;
  const phaseDuration = BEACON_PHASE_DURATION_SECONDS * 1_000;
  let phaseIndex = state.phaseNumber - 1;
  let elapsedPhaseMilliseconds = state.elapsedPhaseMilliseconds + elapsedMilliseconds;
  while (phaseIndex < BEACON_PHASES.length - 1 && elapsedPhaseMilliseconds >= phaseDuration) {
    elapsedPhaseMilliseconds -= phaseDuration;
    phaseIndex += 1;
  }
  if (phaseIndex === BEACON_PHASES.length - 1) elapsedPhaseMilliseconds = Math.min(phaseDuration, elapsedPhaseMilliseconds);
  return deriveBeaconState({ phaseIndex, elapsedPhaseMilliseconds, elapsedRunMilliseconds: state.elapsedRunMilliseconds + elapsedMilliseconds, victoryAchieved: state.victoryAchieved }, context);
}

export function refreshBeaconDerivedState(state: BeaconState, context: BeaconDerivationContext): BeaconState {
  return deriveBeaconState({ phaseIndex: state.phaseNumber - 1, elapsedPhaseMilliseconds: state.elapsedPhaseMilliseconds, elapsedRunMilliseconds: state.elapsedRunMilliseconds, victoryAchieved: state.victoryAchieved }, context);
}

export function activateBeacon(state: BeaconState): { readonly status: "activated"; readonly state: BeaconState } | { readonly status: Exclude<BeaconVictoryAvailability["status"], "available">; readonly state: BeaconState } {
  if (state.victoryAvailability.status !== "available") return { status: state.victoryAvailability.status, state };
  return { status: "activated", state: Object.freeze({ ...state, victoryAchieved: true, victoryAvailability: Object.freeze({ status: "already-activated" as const }) }) };
}

export function getBeaconModifiers(phaseNumber: number): BeaconModifiers {
  return Object.freeze({
    populationFoodConsumptionMultiplier: phaseNumber >= 5 ? 1.35 : phaseNumber >= 2 ? 1.1 : 1,
    farmProductionMultiplier: phaseNumber >= 5 ? 0.7 : phaseNumber >= 3 ? 0.9 : 1,
    forestProductionMultiplier: phaseNumber >= 5 ? 0.7 : phaseNumber >= 3 ? 0.9 : 1,
    staffedProductionPowerDemandAddition: phaseNumber >= 4 ? 1 : 0,
    powerPlantOutputAdjustment: phaseNumber >= 5 ? -1 : 0,
  });
}

export function calculateBeaconFailureRisk(phaseNumber: number, context: BeaconDerivationContext): BeaconFailureRisk {
  const score = Math.max(0, phaseNumber - 1) + (context.latestPopulationSupplied ? 0 : 2) + (context.powerShortage ? 2 : 0) + Math.min(2, context.totalUnsuppliedCycles);
  return score >= 7 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low";
}

function deriveBeaconState(timing: { phaseIndex: number; elapsedPhaseMilliseconds: number; elapsedRunMilliseconds: number; victoryAchieved: boolean }, context: BeaconDerivationContext): BeaconState {
  const definition = BEACON_PHASES[timing.phaseIndex];
  const tierFourIds = TECHNOLOGY_DEFINITIONS.filter((technology) => technology.tier === 4).map((technology) => technology.id);
  const completed = new Set(context.completedTechnologies);
  const requirements: BeaconRequirementProgress = Object.freeze({
    population: requirement(context.population, BEACON_VICTORY_REQUIREMENTS.population),
    food: requirement(context.food, BEACON_VICTORY_REQUIREMENTS.food),
    materials: requirement(context.materials, BEACON_VICTORY_REQUIREMENTS.materials),
    power: requirement(context.powerGeneration, BEACON_VICTORY_REQUIREMENTS.powerGeneration),
    research: requirement(tierFourIds.filter((id) => completed.has(id)).length, tierFourIds.length),
  });
  const allMet = Object.values(requirements).every((item) => item.met);
  const victoryAvailability: BeaconVictoryAvailability = timing.victoryAchieved
    ? Object.freeze({ status: "already-activated" })
    : definition.number !== 5
      ? Object.freeze({ status: "wrong-phase" })
      : allMet
        ? Object.freeze({ status: "available" })
        : Object.freeze({ status: "requirements-not-met" });
  const phaseDuration = BEACON_PHASE_DURATION_SECONDS * 1_000;
  return Object.freeze({ currentPhase: definition.phase, phaseNumber: definition.number, elapsedPhaseMilliseconds: timing.elapsedPhaseMilliseconds, elapsedRunMilliseconds: timing.elapsedRunMilliseconds, nextPhaseCountdownMilliseconds: definition.number === 5 ? 0 : Math.max(0, phaseDuration - timing.elapsedPhaseMilliseconds), modifiers: getBeaconModifiers(definition.number), requirements, victoryAvailability, failureRisk: calculateBeaconFailureRisk(definition.number, context), victoryAchieved: timing.victoryAchieved, validationStatus: "valid" });
}

function requirement(current: number, required: number) {
  return Object.freeze({ current, required, progress: required === 0 ? 1 : Math.min(1, Math.max(0, current / required)), met: current >= required });
}

export function validateBeaconFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  let state = createBeaconState();
  state = advanceBeaconProgression(state, 299_999, EMPTY_CONTEXT)!;
  if (state.phaseNumber !== 1 || state.nextPhaseCountdownMilliseconds !== 1) errors.push("Beacon countdown boundary failed.");
  state = advanceBeaconProgression(state, 1, EMPTY_CONTEXT)!;
  if (state.phaseNumber !== 2) errors.push("Beacon phase transition failed.");
  state = advanceBeaconProgression(state, 900_000, EMPTY_CONTEXT)!;
  if (state.phaseNumber !== 5) errors.push("Delayed Beacon transitions failed.");
  const modifiers = state.modifiers;
  if (modifiers.populationFoodConsumptionMultiplier !== 1.35 || modifiers.farmProductionMultiplier !== 0.7 || modifiers.staffedProductionPowerDemandAddition !== 1 || modifiers.powerPlantOutputAdjustment !== -1) errors.push("Cumulative Beacon modifiers failed.");
  const victoryContext: BeaconDerivationContext = { population: 20, food: 250, materials: 300, powerGeneration: 12, powerShortage: false, latestPopulationSupplied: true, totalUnsuppliedCycles: 0, completedTechnologies: Object.freeze(["colony-optimization"]) };
  const ready = refreshBeaconDerivedState(state, victoryContext);
  if (ready.victoryAvailability.status !== "available" || activateBeacon(ready).status !== "activated") errors.push("Beacon victory activation failed.");
  if (!Object.values(ready.requirements).every((requirement) => requirement.progress === 1 && requirement.met)) errors.push("Beacon requirement progress bars must reach 100% at their thresholds.");
  const partial = refreshBeaconDerivedState(state, { ...victoryContext, population: 10 });
  if (partial.requirements.population.progress !== 0.5 || partial.victoryAvailability.status !== "requirements-not-met") errors.push("Beacon partial requirement progress failed.");
  const early = refreshBeaconDerivedState(createBeaconState(), victoryContext);
  if (early.victoryAvailability.status !== "wrong-phase") errors.push("Beacon must activate only in Phase 5.");
  if (calculateBeaconFailureRisk(5, { ...EMPTY_CONTEXT, powerShortage: true, latestPopulationSupplied: false, totalUnsuppliedCycles: 2 }) !== "critical") errors.push("Beacon critical risk derivation failed.");
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}
