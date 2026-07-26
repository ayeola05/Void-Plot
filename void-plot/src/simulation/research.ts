import {
  DEFAULT_INITIAL_RESEARCH_POINTS,
  TECHNOLOGY_DEFINITIONS,
  getTechnologyDefinition,
  type TechnologyId,
} from "../data/researchDefinitions";

export interface ResearchState {
  readonly researchPoints: number;
  readonly completedTechnologies: readonly TechnologyId[];
  readonly activeTechnology?: TechnologyId;
  readonly accumulatedResearchProgress: number;
  readonly completedOrder: readonly TechnologyId[];
  readonly validationStatus: "valid";
}

export type ResearchSelectionResult =
  | { readonly status: "selected"; readonly state: ResearchState }
  | { readonly status: "already-active" | "already-completed" | "locked" | "technology-not-found" | "invalid-state" };

export type ResearchProgressionResult =
  | { readonly status: "idle" | "waiting-for-rp" | "waiting-for-lab"; readonly state: ResearchState }
  | { readonly status: "progressed"; readonly state: ResearchState; readonly researchPointsSpent: number }
  | { readonly status: "completed"; readonly state: ResearchState; readonly technologyId: TechnologyId; readonly researchPointsSpent: number }
  | { readonly status: "invalid-state"; readonly state: ResearchState };

export function createResearchState(initialResearchPoints = DEFAULT_INITIAL_RESEARCH_POINTS): ResearchState {
  if (!Number.isSafeInteger(initialResearchPoints) || initialResearchPoints < 0) {
    return Object.freeze({ researchPoints: 0, completedTechnologies: Object.freeze([]), accumulatedResearchProgress: 0, completedOrder: Object.freeze([]), validationStatus: "valid" });
  }
  return Object.freeze({ researchPoints: initialResearchPoints, completedTechnologies: Object.freeze([]), accumulatedResearchProgress: 0, completedOrder: Object.freeze([]), validationStatus: "valid" });
}

export function validateResearchState(state: ResearchState): boolean {
  const completed = new Set(state.completedTechnologies);
  return Number.isSafeInteger(state.researchPoints) && state.researchPoints >= 0 &&
    Number.isSafeInteger(state.accumulatedResearchProgress) && state.accumulatedResearchProgress >= 0 &&
    state.validationStatus === "valid" && completed.size === state.completedTechnologies.length &&
    state.completedOrder.length === state.completedTechnologies.length &&
    state.completedOrder.every((id) => completed.has(id) && getTechnologyDefinition(id) !== undefined) &&
    (state.activeTechnology === undefined || (!completed.has(state.activeTechnology) && getTechnologyDefinition(state.activeTechnology) !== undefined));
}

export function addResearchPoints(state: ResearchState, amount: number): ResearchState | undefined {
  if (!validateResearchState(state) || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(state.researchPoints + amount)) return undefined;
  return Object.freeze({ ...state, researchPoints: state.researchPoints + amount });
}

export function prerequisitesMet(state: ResearchState, technologyId: TechnologyId): boolean {
  const technology = getTechnologyDefinition(technologyId);
  if (technology === undefined || technology.prerequisite.type === "none") return technology !== undefined;
  const completed = new Set(state.completedTechnologies);
  return technology.prerequisite.type === "all"
    ? technology.prerequisite.technologyIds.every((id) => completed.has(id))
    : technology.prerequisite.technologyIds.some((id) => completed.has(id));
}

export function selectTechnology(state: ResearchState, technologyId: TechnologyId): ResearchSelectionResult {
  if (!validateResearchState(state)) return { status: "invalid-state" };
  if (getTechnologyDefinition(technologyId) === undefined) return { status: "technology-not-found" };
  if (state.completedTechnologies.includes(technologyId)) return { status: "already-completed" };
  if (state.activeTechnology !== undefined) return { status: "already-active" };
  if (!prerequisitesMet(state, technologyId)) return { status: "locked" };
  return { status: "selected", state: Object.freeze({ ...state, activeTechnology: technologyId, accumulatedResearchProgress: 0 }) };
}

export function advanceResearchProgression(state: ResearchState, researchLabActive = true): ResearchProgressionResult {
  if (!validateResearchState(state)) return { status: "invalid-state", state };
  if (state.activeTechnology === undefined) return { status: "idle", state };
  if (!researchLabActive) return { status: "waiting-for-lab", state };
  if (state.researchPoints === 0) return { status: "waiting-for-rp", state };
  const technology = getTechnologyDefinition(state.activeTechnology)!;
  const remaining = technology.cost - state.accumulatedResearchProgress;
  const spent = Math.min(remaining, state.researchPoints);
  const progress = state.accumulatedResearchProgress + spent;
  if (progress < technology.cost) {
    return { status: "progressed", researchPointsSpent: spent, state: Object.freeze({ ...state, researchPoints: state.researchPoints - spent, accumulatedResearchProgress: progress }) };
  }
  const completed = state.activeTechnology;
  return {
    status: "completed",
    technologyId: completed,
    researchPointsSpent: spent,
    state: Object.freeze({ researchPoints: state.researchPoints - spent, completedTechnologies: Object.freeze([...state.completedTechnologies, completed]), activeTechnology: undefined, accumulatedResearchProgress: 0, completedOrder: Object.freeze([...state.completedOrder, completed]), validationStatus: "valid" }),
  };
}

export function validateResearchFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  let state = createResearchState(10);
  const locked = selectTechnology(state, "efficient-turbines");
  if (locked.status !== "locked") errors.push("Prerequisites must lock technologies.");
  const selected = selectTechnology(state, "efficient-farming");
  if (selected.status !== "selected") errors.push("Unlocked technology selection failed.");
  else {
    const completed = advanceResearchProgression(selected.state);
    if (completed.status !== "completed" || !completed.state.completedTechnologies.includes("efficient-farming") || completed.state.activeTechnology !== undefined) errors.push("Research completion failed.");
    else {
      state = completed.state;
      if (selectTechnology(state, "efficient-farming").status !== "already-completed") errors.push("Completed technology must not repeat.");
    }
  }
  const noRp = selectTechnology(createResearchState(), "survey-equipment");
  if (noRp.status !== "selected" || advanceResearchProgression(noRp.state).status !== "waiting-for-rp") errors.push("Research without RP must preserve active progress.");
  if (TECHNOLOGY_DEFINITIONS.length !== 10) errors.push("Technology graph must contain exactly ten technologies.");
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}
