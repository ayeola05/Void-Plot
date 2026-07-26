import type { ExpeditionSectorSize } from "../world";

export interface ExpeditionDefinition {
  readonly sectorSize: ExpeditionSectorSize;
  readonly requiredWorkers: number;
  readonly materialCost: number;
  readonly durationSeconds: number;
}

export const MAX_ACTIVE_EXPEDITIONS = 1;

export const EXPEDITION_DEFINITIONS = Object.freeze({
  2: Object.freeze({
    sectorSize: 2,
    requiredWorkers: 1,
    materialCost: 20,
    durationSeconds: 30,
  }),
  4: Object.freeze({
    sectorSize: 4,
    requiredWorkers: 2,
    materialCost: 60,
    durationSeconds: 90,
  }),
  6: Object.freeze({
    sectorSize: 6,
    requiredWorkers: 3,
    materialCost: 140,
    durationSeconds: 180,
  }),
}) satisfies Readonly<Record<ExpeditionSectorSize, ExpeditionDefinition>>;
