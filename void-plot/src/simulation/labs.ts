import { getBuildingDefinition, validateBuildingState, type BuildingId, type BuildingState, type LabBuildingRecord } from "./buildings";
import { addResearchPoints, validateResearchState, type ResearchState } from "./research";
import { isBuildingPowered, type PowerAllocationSnapshot } from "./power";
import { assignWorkers, releaseWorkers, validateWorkersState, type WorkersState } from "./workers";

export interface LabResearchProductionEvent {
  readonly labId: BuildingId;
  readonly researchPointsProduced: number;
  readonly completedIntervals: number;
  readonly newResearchPointBalance: number;
}

export type LabStaffingResult =
  | { readonly status: "assigned" | "released"; readonly buildingState: BuildingState; readonly workersState: WorkersState }
  | { readonly status: "building-not-found" | "not-a-lab" | "already-assigned" | "already-unassigned" | "insufficient-workers" | "invalid-state" };

export type LabProductionResult =
  | { readonly status: "advanced"; readonly buildingState: BuildingState; readonly researchState: ResearchState; readonly researchPointsProduced: number; readonly productionEvents: readonly LabResearchProductionEvent[] }
  | { readonly status: "invalid-state" | "invalid-delta" };

export function findLabById(state: BuildingState, id: BuildingId): LabBuildingRecord | undefined {
  const building = state.buildings.find((candidate) => candidate.id === id);
  return building?.type === "lab" ? building : undefined;
}

export function hasActiveResearchLab(state: BuildingState, power: PowerAllocationSnapshot): boolean {
  return state.buildings.some((building) => building.type === "lab" && building.assignedWorkers === 1 && isBuildingPowered(power, building.id));
}

export function getLabProductionProgress(lab: LabBuildingRecord, powered: boolean): { readonly status: "unstaffed" | "no-power" | "producing"; readonly progress: number; readonly remainingSeconds: number } {
  const interval = getBuildingDefinition("lab").productionIntervalSeconds * 1_000;
  const progress = Math.min(1, lab.productionTiming.accumulatedMilliseconds / interval);
  return Object.freeze({ status: lab.assignedWorkers === 0 ? "unstaffed" : powered ? "producing" : "no-power", progress, remainingSeconds: (interval - Math.min(interval, lab.productionTiming.accumulatedMilliseconds)) / 1_000 });
}

export function assignWorkerToLab(buildings: BuildingState, workers: WorkersState, id: BuildingId): LabStaffingResult {
  if (!validateBuildingState(buildings) || !validateWorkersState(workers).valid) return { status: "invalid-state" };
  const lab = findLabById(buildings, id);
  if (lab === undefined) return buildings.buildings.some((building) => building.id === id) ? { status: "not-a-lab" } : { status: "building-not-found" };
  if (lab.assignedWorkers === 1) return { status: "already-assigned" };
  const nextWorkers = { ...workers };
  const assignment = assignWorkers(nextWorkers, 1);
  if (assignment.status !== "assigned") return assignment.status === "insufficient-workers" ? { status: "insufficient-workers" } : { status: "invalid-state" };
  return { status: "assigned", workersState: nextWorkers, buildingState: replaceLab(buildings, Object.freeze({ ...lab, assignedWorkers: 1 })) };
}

export function releaseWorkerFromLab(buildings: BuildingState, workers: WorkersState, id: BuildingId): LabStaffingResult {
  if (!validateBuildingState(buildings) || !validateWorkersState(workers).valid) return { status: "invalid-state" };
  const lab = findLabById(buildings, id);
  if (lab === undefined) return buildings.buildings.some((building) => building.id === id) ? { status: "not-a-lab" } : { status: "building-not-found" };
  if (lab.assignedWorkers === 0) return { status: "already-unassigned" };
  const nextWorkers = { ...workers };
  if (releaseWorkers(nextWorkers, 1).status !== "released") return { status: "invalid-state" };
  return { status: "released", workersState: nextWorkers, buildingState: replaceLab(buildings, Object.freeze({ ...lab, assignedWorkers: 0 })) };
}

export function advanceLabResearchProduction(buildings: BuildingState, research: ResearchState, elapsedMilliseconds: number, power: PowerAllocationSnapshot): LabProductionResult {
  if (!validateBuildingState(buildings) || !validateResearchState(research)) return { status: "invalid-state" };
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) return { status: "invalid-delta" };
  const definition = getBuildingDefinition("lab");
  const interval = definition.productionIntervalSeconds * 1_000;
  let total = 0;
  const rawEvents: Array<Omit<LabResearchProductionEvent, "newResearchPointBalance">> = [];
  const nextBuildings = buildings.buildings.map((building) => {
    if (building.type !== "lab" || building.assignedWorkers === 0 || !isBuildingPowered(power, building.id)) return building;
    const accumulated = building.productionTiming.accumulatedMilliseconds + elapsedMilliseconds;
    const completedIntervals = Math.floor(accumulated / interval);
    const produced = completedIntervals * definition.researchPerProductionInterval;
    total += produced;
    if (produced > 0) rawEvents.push({ labId: building.id, researchPointsProduced: produced, completedIntervals });
    return Object.freeze({ ...building, productionTiming: Object.freeze({ accumulatedMilliseconds: accumulated - completedIntervals * interval }) });
  });
  const nextResearch = total === 0 ? research : addResearchPoints(research, total);
  if (nextResearch === undefined) return { status: "invalid-state" };
  let balance = research.researchPoints;
  const events = Object.freeze(rawEvents.map((event) => Object.freeze({ ...event, newResearchPointBalance: balance += event.researchPointsProduced })));
  return { status: "advanced", buildingState: Object.freeze({ buildings: Object.freeze(nextBuildings) }), researchState: nextResearch, researchPointsProduced: total, productionEvents: events };
}

function replaceLab(state: BuildingState, lab: LabBuildingRecord): BuildingState {
  return Object.freeze({ buildings: Object.freeze(state.buildings.map((building) => building.id === lab.id ? lab : building)) });
}

export function validateLabFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const lab: LabBuildingRecord = Object.freeze({ id: "lab", type: "lab", status: "constructed", coordinate: Object.freeze({ x: 12, y: 12 }), assignedWorkers: 1, productionTiming: Object.freeze({ accumulatedMilliseconds: 0 }) });
  const buildings = Object.freeze({ buildings: Object.freeze([lab]) });
  const powered: PowerAllocationSnapshot = Object.freeze({ totalPowerGenerated: 1, totalPowerDemand: 1, totalPowerAllocated: 1, availablePower: 0, poweredBuildingIds: Object.freeze(["lab"]), unpoweredBuildingIds: Object.freeze([]), allocations: Object.freeze([]) });
  const produced = advanceLabResearchProduction(buildings, createResearchFixture(), 10_000, powered);
  const pausedLab = Object.freeze({ ...lab, productionTiming: Object.freeze({ accumulatedMilliseconds: 2_500 }) });
  const pausedBuildings = Object.freeze({ buildings: Object.freeze([pausedLab]) });
  const paused = advanceLabResearchProduction(pausedBuildings, createResearchFixture(), 10_000, { ...powered, poweredBuildingIds: Object.freeze([]), unpoweredBuildingIds: Object.freeze(["lab"]) });
  const secondLab = Object.freeze({ ...lab, id: "lab-2", coordinate: Object.freeze({ x: 13, y: 12 }) });
  const multiple = advanceLabResearchProduction(Object.freeze({ buildings: Object.freeze([lab, secondLab]) }), createResearchFixture(), 5_000, { ...powered, poweredBuildingIds: Object.freeze(["lab", "lab-2"]) });
  const unstaffed = Object.freeze({ ...lab, assignedWorkers: 0 as const });
  const assigned = assignWorkerToLab(Object.freeze({ buildings: Object.freeze([unstaffed]) }), { totalWorkers: 1, availableWorkers: 1, assignedWorkers: 0 }, "lab");
  const released = assigned.status === "assigned" ? releaseWorkerFromLab(assigned.buildingState, assigned.workersState, "lab") : assigned;
  const valid = produced.status === "advanced" && produced.researchPointsProduced === 2 && multiple.status === "advanced" && multiple.researchPointsProduced === 2 && paused.status === "advanced" && paused.researchPointsProduced === 0 && findLabById(paused.buildingState, "lab")?.productionTiming.accumulatedMilliseconds === 2_500 && assigned.status === "assigned" && released.status === "released";
  return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Lab production or pause behavior failed."]) };
}

function createResearchFixture(): ResearchState {
  return { researchPoints: 0, completedTechnologies: Object.freeze([]), accumulatedResearchProgress: 0, completedOrder: Object.freeze([]), validationStatus: "valid" };
}
