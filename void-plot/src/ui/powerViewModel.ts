import {
  hasPowerShortage,
  type PowerAllocationSnapshot,
} from "../simulation";

export interface PowerResourceViewModel {
  readonly value: string;
  readonly demand: number;
  readonly shortage: boolean;
  readonly statusText: string;
}

export function createPowerResourceViewModel(
  snapshot: PowerAllocationSnapshot,
): PowerResourceViewModel {
  const shortage = hasPowerShortage(snapshot);
  return Object.freeze({
    value: `${snapshot.totalPowerAllocated}/${snapshot.totalPowerGenerated}`,
    demand: snapshot.totalPowerDemand,
    shortage,
    statusText: shortage
      ? `Demand: ${snapshot.totalPowerDemand} • Power shortage`
      : `Demand: ${snapshot.totalPowerDemand}`,
  });
}

export function validatePowerResourceViewModelFoundation(): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  const normal = createPowerResourceViewModel(
    createSnapshot(4, 3, 3, ["farm-1", "forest-1", "forest-2"], []),
  );
  const shortage = createPowerResourceViewModel(
    createSnapshot(4, 5, 4, ["farm-1", "farm-2", "forest-1", "forest-2"], ["forest-3"]),
  );

  if (
    normal.value !== "3/4" ||
    normal.demand !== 3 ||
    normal.shortage ||
    normal.statusText !== "Demand: 3"
  ) {
    errors.push("Normal Power UI state must show allocated/generated and demand.");
  }

  if (
    shortage.value !== "4/4" ||
    !shortage.shortage ||
    shortage.statusText !== "Demand: 5 • Power shortage"
  ) {
    errors.push("Power shortage UI state must expose a concise warning.");
  }

  return { valid: errors.length === 0, errors };
}

function createSnapshot(
  generated: number,
  demand: number,
  allocated: number,
  powered: readonly string[],
  unpowered: readonly string[],
): PowerAllocationSnapshot {
  return {
    totalPowerGenerated: generated,
    totalPowerDemand: demand,
    totalPowerAllocated: allocated,
    availablePower: generated - allocated,
    poweredBuildingIds: powered,
    unpoweredBuildingIds: unpowered,
    allocations: [],
  };
}
