export interface RunStatistics {
  runTimeMilliseconds: number;
  buildingsBuilt: number;
  workersRecruited: number;
  populationPeak: number;
  foodProduced: number;
  materialsProduced: number;
  researchPointsProduced: number;
  researchCompleted: number;
  eventsTriggered: number;
  eventsResolved: number;
  expeditionsCompleted: number;
  beaconPhaseReached: number;
}

export function createRunStatistics(initialPopulation = 0): RunStatistics {
  return { runTimeMilliseconds: 0, buildingsBuilt: 0, workersRecruited: 0, populationPeak: initialPopulation, foodProduced: 0, materialsProduced: 0, researchPointsProduced: 0, researchCompleted: 0, eventsTriggered: 0, eventsResolved: 0, expeditionsCompleted: 0, beaconPhaseReached: 1 };
}

export function formatRunStatistics(stats: RunStatistics): readonly string[] {
  const totalSeconds = Math.floor(stats.runTimeMilliseconds / 1_000);
  return Object.freeze([
    `Run Time  ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`,
    `Buildings Constructed  ${stats.buildingsBuilt}`,
    `Workers Recruited  ${stats.workersRecruited}`,
    `Population Peak  ${stats.populationPeak}`,
    `Food Produced  ${stats.foodProduced}`,
    `Materials Produced  ${stats.materialsProduced}`,
    `RP Produced  ${stats.researchPointsProduced}`,
    `Research Completed  ${stats.researchCompleted}`,
    `Events Triggered / Survived  ${stats.eventsTriggered} / ${stats.eventsResolved}`,
    `Expeditions Completed  ${stats.expeditionsCompleted}`,
    `Beacon Phase Reached  ${stats.beaconPhaseReached}`,
  ]);
}

export function validateRunStatisticsFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const state = createRunStatistics(4);
  state.runTimeMilliseconds = 125_000;
  return { valid: state.populationPeak === 4 && formatRunStatistics(state)[0] === "Run Time  2m 5s", errors: Object.freeze([]) };
}
