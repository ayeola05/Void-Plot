import type { RunStatistics } from "./runStatistics";

export const GAME_VERSION = "1.0.0-rc.1";

export type SettlementRating =
  | "Abandoned"
  | "Struggling"
  | "Surviving"
  | "Prospering"
  | "Thriving"
  | "Legendary";

export function calculateSettlementRating(statistics: RunStatistics): SettlementRating {
  const score =
    statistics.populationPeak * 2 +
    statistics.buildingsBuilt * 3 +
    statistics.researchCompleted * 5 +
    statistics.expeditionsCompleted * 4 +
    statistics.eventsResolved * 2 +
    statistics.beaconPhaseReached * 4;
  if (score >= 120) return "Legendary";
  if (score >= 90) return "Thriving";
  if (score >= 65) return "Prospering";
  if (score >= 40) return "Surviving";
  if (score >= 20) return "Struggling";
  return "Abandoned";
}

export function createSettlementNarrative(statistics: RunStatistics): string {
  const rating = calculateSettlementRating(statistics);
  switch (rating) {
    case "Legendary": return "The colony endured impossible conditions and became a beacon of hope.";
    case "Thriving": return "Against the void, the settlement built a future bright enough to guide others home.";
    case "Prospering": return "Careful choices turned the last acre into a determined and flourishing refuge.";
    case "Surviving": return "The settlement held together, carrying humanity through one hard-won day after another.";
    case "Struggling": return "Scarcity marked every choice, but the colony refused to disappear quietly.";
    case "Abandoned": return "The last acre fell silent before its promise could be fulfilled.";
  }
}

