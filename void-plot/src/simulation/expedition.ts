import {
  EXPEDITION_DEFINITIONS,
  MAX_ACTIVE_EXPEDITIONS,
} from "../data";
import {
  countRevealedTiles,
  createWorld,
  sectorContainsHiddenTile,
  validateExpeditionSectorSelection,
  type ExpeditionSectorBounds,
  type ExpeditionSectorOrigin,
  type ExpeditionSectorSelectionResult,
  type ExpeditionSectorSize,
  type TileCoordinate,
  type WorldState,
} from "../world";

export type ExpeditionId = string;

export type ExpeditionStatus =
  | "planned"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export const EXPEDITION_REVEAL_STATUS = "completed" satisfies ExpeditionStatus;
export const EXPEDITION_NON_REVEAL_STATUSES = Object.freeze(
  ["planned", "active", "failed", "cancelled"] as const,
) satisfies readonly ExpeditionStatus[];
export const TEMPORARY_EXPEDITION_SUCCESS_IS_GUARANTEED = true;

export interface ExpeditionSectorSnapshot {
  readonly size: ExpeditionSectorSize;
  readonly origin: Readonly<ExpeditionSectorOrigin>;
  readonly bounds: Readonly<ExpeditionSectorBounds>;
  readonly coveredCoordinates: readonly Readonly<TileCoordinate>[];
  readonly hiddenCoordinatesAtPlanning: readonly Readonly<TileCoordinate>[];
  /** Captured by future activation revalidation; planning leaves this undefined. */
  readonly hiddenCoordinatesAtStart?: readonly Readonly<TileCoordinate>[];
}

export interface ExpeditionRequirements {
  readonly materialCost: number;
  readonly requiredWorkers: number;
}

export interface ExpeditionTiming {
  readonly durationSeconds: number;
  readonly elapsedSeconds: number;
  readonly startedAtMilliseconds?: number;
  readonly expectedCompletionAtMilliseconds?: number;
}

export interface ExpeditionRecord {
  readonly id: ExpeditionId;
  readonly status: ExpeditionStatus;
  readonly sector: ExpeditionSectorSnapshot;
  readonly requirements: ExpeditionRequirements;
  readonly timing: ExpeditionTiming;
}

export interface ExpeditionState {
  readonly expeditions: readonly ExpeditionRecord[];
}

export type ExpeditionIdFactory = () => ExpeditionId;

type InvalidSectorSelectionResult = Exclude<
  ExpeditionSectorSelectionResult,
  { status: "valid" }
>;

export type ExpeditionPlanningValidationResult =
  | {
      readonly status: "valid";
      readonly sector: Extract<
        ExpeditionSectorSelectionResult,
        { status: "valid" }
      >;
    }
  | {
      readonly status:
        | "out-of-bounds"
        | "already-fully-revealed"
        | "not-adjacent";
      readonly sector: InvalidSectorSelectionResult;
    }
  | {
      readonly status: "duplicate-sector";
      readonly conflictingExpeditionId: ExpeditionId;
    };

export type CreatePlannedExpeditionResult =
  | {
      readonly status: "planned";
      readonly state: ExpeditionState;
      readonly expedition: ExpeditionRecord;
    }
  | Exclude<ExpeditionPlanningValidationResult, { status: "valid" }>
  | {
      readonly status: "duplicate-id";
      readonly expeditionId: ExpeditionId;
    };

export type ExpeditionTransitionValidationResult =
  | {
      readonly status: "valid";
      readonly expedition: ExpeditionRecord;
      readonly nextStatus: ExpeditionStatus;
    }
  | {
      readonly status: "unknown-expedition";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "invalid-transition";
      readonly expeditionId: ExpeditionId;
      readonly currentStatus: ExpeditionStatus;
      readonly requestedStatus: ExpeditionStatus;
    }
  | {
      readonly status: "active-limit-reached";
      readonly expeditionId: ExpeditionId;
      readonly maximumActiveExpeditions: number;
    };

export type ApplyExpeditionTransitionResult =
  | {
      readonly status: "transitioned";
      readonly state: ExpeditionState;
      readonly expedition: ExpeditionRecord;
      readonly previousStatus: ExpeditionStatus;
    }
  | Exclude<ExpeditionTransitionValidationResult, { status: "valid" }>;

export interface ExpeditionDomainValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly expeditionCountBeforeValidation: number;
  readonly expeditionCountAfterValidation: number;
  readonly expeditionCountAfterPlanning: number;
  readonly revealedTileCountBefore: number;
  readonly revealedTileCountAfter: number;
}

const ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<ExpeditionStatus, readonly ExpeditionStatus[]>
> = Object.freeze({
  planned: Object.freeze(["active", "cancelled"] as const),
  active: Object.freeze(["completed", "failed", "cancelled"] as const),
  completed: Object.freeze([] as const),
  failed: Object.freeze([] as const),
  cancelled: Object.freeze([] as const),
});

export function createExpeditionState(): ExpeditionState {
  return Object.freeze({ expeditions: Object.freeze([]) });
}

export function getExpeditionRequirements(
  size: ExpeditionSectorSize,
  modifiers: { readonly materialCostMultiplier?: number; readonly durationMultiplier?: number } = {},
): ExpeditionRequirements & Pick<ExpeditionTiming, "durationSeconds"> {
  const definition = EXPEDITION_DEFINITIONS[size];

  return Object.freeze({
    materialCost: Math.ceil(definition.materialCost * (modifiers.materialCostMultiplier ?? 1)),
    requiredWorkers: definition.requiredWorkers,
    durationSeconds: definition.durationSeconds * (modifiers.durationMultiplier ?? 1),
  });
}

export function findExpeditionById(
  state: ExpeditionState,
  expeditionId: ExpeditionId,
): ExpeditionRecord | undefined {
  return state.expeditions.find(
    (expedition) => expedition.id === expeditionId,
  );
}

export function countExpeditionsByStatus(
  state: ExpeditionState,
  status: ExpeditionStatus,
): number {
  return state.expeditions.filter(
    (expedition) => expedition.status === status,
  ).length;
}

export function countActiveExpeditions(state: ExpeditionState): number {
  return countExpeditionsByStatus(state, "active");
}

export function isExpeditionStatusTerminal(
  status: ExpeditionStatus,
): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function expeditionBoundsMatch(
  first: Readonly<ExpeditionSectorBounds>,
  second: Readonly<ExpeditionSectorBounds>,
): boolean {
  return (
    first.minX === second.minX &&
    first.minY === second.minY &&
    first.maxX === second.maxX &&
    first.maxY === second.maxY
  );
}

export function findDuplicatePlannedOrActiveSector(
  state: ExpeditionState,
  bounds: Readonly<ExpeditionSectorBounds>,
  excludedExpeditionId?: ExpeditionId,
): ExpeditionRecord | undefined {
  return state.expeditions.find(
    (expedition) =>
      expedition.id !== excludedExpeditionId &&
      (expedition.status === "planned" || expedition.status === "active") &&
      expeditionBoundsMatch(expedition.sector.bounds, bounds),
  );
}

export function hasDuplicatePlannedOrActiveSector(
  state: ExpeditionState,
  bounds: Readonly<ExpeditionSectorBounds>,
  excludedExpeditionId?: ExpeditionId,
): boolean {
  return (
    findDuplicatePlannedOrActiveSector(
      state,
      bounds,
      excludedExpeditionId,
    ) !== undefined
  );
}

export function validateExpeditionPlanning(
  world: WorldState,
  state: ExpeditionState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): ExpeditionPlanningValidationResult {
  const sector = validateExpeditionSectorSelection(world, origin, size);

  if (sector.status !== "valid") {
    return invalidPlanningResult(sector);
  }

  if (!sectorContainsHiddenTile(world, origin, size)) {
    return {
      status: "already-fully-revealed",
      sector: {
        ...sector,
        status: "already-fully-revealed",
        hiddenCoordinates: [],
      },
    };
  }

  const duplicate = findDuplicatePlannedOrActiveSector(state, sector.bounds);

  return duplicate === undefined
    ? { status: "valid", sector }
    : {
        status: "duplicate-sector",
        conflictingExpeditionId: duplicate.id,
      };
}

export function createPlannedExpedition(
  world: WorldState,
  state: ExpeditionState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
  idFactory: ExpeditionIdFactory,
  modifiers: { readonly materialCostMultiplier?: number; readonly durationMultiplier?: number } = {},
): CreatePlannedExpeditionResult {
  const validation = validateExpeditionPlanning(world, state, origin, size);

  if (validation.status !== "valid") {
    return validation;
  }

  const expeditionId = idFactory();

  if (findExpeditionById(state, expeditionId) !== undefined) {
    return { status: "duplicate-id", expeditionId };
  }

  const derived = getExpeditionRequirements(size, modifiers);
  const expedition: ExpeditionRecord = Object.freeze({
    id: expeditionId,
    status: "planned",
    sector: createSectorSnapshot(validation.sector),
    requirements: Object.freeze({
      materialCost: derived.materialCost,
      requiredWorkers: derived.requiredWorkers,
    }),
    timing: Object.freeze({
      durationSeconds: derived.durationSeconds,
      elapsedSeconds: 0,
    }),
  });
  const nextState: ExpeditionState = Object.freeze({
    expeditions: Object.freeze([...state.expeditions, expedition]),
  });

  return { status: "planned", state: nextState, expedition };
}

export function isExpeditionStatusTransitionAllowed(
  currentStatus: ExpeditionStatus,
  requestedStatus: ExpeditionStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(requestedStatus);
}

export function validateExpeditionStatusTransition(
  state: ExpeditionState,
  expeditionId: ExpeditionId,
  requestedStatus: ExpeditionStatus,
): ExpeditionTransitionValidationResult {
  const expedition = findExpeditionById(state, expeditionId);

  if (expedition === undefined) {
    return { status: "unknown-expedition", expeditionId };
  }

  if (!isExpeditionStatusTransitionAllowed(expedition.status, requestedStatus)) {
    return {
      status: "invalid-transition",
      expeditionId,
      currentStatus: expedition.status,
      requestedStatus,
    };
  }

  if (
    expedition.status === "planned" &&
    requestedStatus === "active" &&
    countActiveExpeditions(state) >= MAX_ACTIVE_EXPEDITIONS
  ) {
    return {
      status: "active-limit-reached",
      expeditionId,
      maximumActiveExpeditions: MAX_ACTIVE_EXPEDITIONS,
    };
  }

  return { status: "valid", expedition, nextStatus: requestedStatus };
}

export function applyExpeditionStatusTransition(
  state: ExpeditionState,
  expeditionId: ExpeditionId,
  requestedStatus: ExpeditionStatus,
): ApplyExpeditionTransitionResult {
  const validation = validateExpeditionStatusTransition(
    state,
    expeditionId,
    requestedStatus,
  );

  if (validation.status !== "valid") {
    return validation;
  }

  const transitionedExpedition: ExpeditionRecord = Object.freeze({
    ...validation.expedition,
    status: requestedStatus,
  });
  const nextState: ExpeditionState = Object.freeze({
    expeditions: Object.freeze(
      state.expeditions.map((expedition) =>
        expedition.id === expeditionId ? transitionedExpedition : expedition,
      ),
    ),
  });

  return {
    status: "transitioned",
    state: nextState,
    expedition: transitionedExpedition,
    previousStatus: validation.expedition.status,
  };
}

function invalidPlanningResult(
  sector: InvalidSectorSelectionResult,
): ExpeditionPlanningValidationResult {
  switch (sector.status) {
    case "out-of-bounds":
      return { status: "out-of-bounds", sector };
    case "already-fully-revealed":
      return { status: "already-fully-revealed", sector };
    case "not-adjacent":
      return { status: "not-adjacent", sector };
  }
}

function createSectorSnapshot(
  sector: Extract<ExpeditionSectorSelectionResult, { status: "valid" }>,
): ExpeditionSectorSnapshot {
  return Object.freeze({
    size: sector.size,
    origin: Object.freeze({ ...sector.origin }),
    bounds: Object.freeze({ ...sector.bounds }),
    coveredCoordinates: freezeCoordinates(sector.coordinates),
    hiddenCoordinatesAtPlanning: freezeCoordinates(sector.hiddenCoordinates),
  });
}

function freezeCoordinates(
  coordinates: readonly TileCoordinate[],
): readonly Readonly<TileCoordinate>[] {
  return Object.freeze(
    coordinates.map((coordinate) => Object.freeze({ ...coordinate })),
  );
}

export function validateExpeditionDomainFoundation(): ExpeditionDomainValidationResult {
  const world = createWorld();
  const emptyState = createExpeditionState();
  const errors: string[] = [];
  const revealedTileCountBefore = countRevealedTiles(world);
  const expeditionCountBeforeValidation = emptyState.expeditions.length;

  const expectedRequirements = {
    2: { materialCost: 20, requiredWorkers: 1, durationSeconds: 30 },
    4: { materialCost: 60, requiredWorkers: 2, durationSeconds: 90 },
    6: { materialCost: 140, requiredWorkers: 3, durationSeconds: 180 },
  } as const;

  for (const size of [2, 4, 6] as const) {
    const actual = getExpeditionRequirements(size);
    const expected = expectedRequirements[size];

    if (
      actual.materialCost !== expected.materialCost ||
      actual.requiredWorkers !== expected.requiredWorkers ||
      actual.durationSeconds !== expected.durationSeconds
    ) {
      errors.push(`Requirements for ${size}×${size} are incorrect.`);
    }
  }

  const validPlanning = validateExpeditionPlanning(
    world,
    emptyState,
    { x: 10, y: 12 },
    2,
  );
  const invalidPlanning = validateExpeditionPlanning(
    world,
    emptyState,
    { x: 0, y: 0 },
    2,
  );
  const expeditionCountAfterValidation = emptyState.expeditions.length;

  if (validPlanning.status !== "valid") {
    errors.push("An adjacent hidden sector must pass planning validation.");
  }

  if (invalidPlanning.status !== "not-adjacent") {
    errors.push("A non-frontier sector must fail planning validation.");
  }

  const firstPlan = createPlannedExpedition(
    world,
    emptyState,
    { x: 10, y: 12 },
    2,
    () => "expedition-001",
  );

  if (firstPlan.status !== "planned") {
    errors.push("A valid sector must create a planned expedition.");
    return finishDomainValidation(
      errors,
      expeditionCountBeforeValidation,
      expeditionCountAfterValidation,
      0,
      revealedTileCountBefore,
      countRevealedTiles(world),
    );
  }

  if (
    firstPlan.expedition.id !== "expedition-001" ||
    firstPlan.expedition.sector.coveredCoordinates.length !== 4 ||
    firstPlan.expedition.sector.hiddenCoordinatesAtPlanning.length !== 4
  ) {
    errors.push("Planning must use the injected ID and immutable sector data.");
  }

  const duplicatePlan = createPlannedExpedition(
    world,
    firstPlan.state,
    { x: 10, y: 12 },
    2,
    () => "expedition-duplicate",
  );

  if (duplicatePlan.status !== "duplicate-sector") {
    errors.push("Duplicate planned or active sector bounds must be rejected.");
  }

  const secondPlan = createPlannedExpedition(
    world,
    firstPlan.state,
    { x: 10, y: 14 },
    2,
    () => "expedition-002",
  );

  if (secondPlan.status !== "planned") {
    errors.push("A distinct valid sector must be plannable.");
    return finishDomainValidation(
      errors,
      expeditionCountBeforeValidation,
      expeditionCountAfterValidation,
      firstPlan.state.expeditions.length,
      revealedTileCountBefore,
      countRevealedTiles(world),
    );
  }

  const plannedToCancelled = validateExpeditionStatusTransition(
    firstPlan.state,
    "expedition-001",
    "cancelled",
  );
  const firstActivation = applyExpeditionStatusTransition(
    secondPlan.state,
    "expedition-001",
    "active",
  );

  if (plannedToCancelled.status !== "valid") {
    errors.push("A planned expedition must allow cancellation.");
  }

  if (firstActivation.status !== "transitioned") {
    errors.push("A planned expedition must transition to active.");
    return finishDomainValidation(
      errors,
      expeditionCountBeforeValidation,
      expeditionCountAfterValidation,
      secondPlan.state.expeditions.length,
      revealedTileCountBefore,
      countRevealedTiles(world),
    );
  }

  for (const terminalStatus of ["completed", "failed", "cancelled"] as const) {
    if (
      validateExpeditionStatusTransition(
        firstActivation.state,
        "expedition-001",
        terminalStatus,
      ).status !== "valid"
    ) {
      errors.push(`An active expedition must allow ${terminalStatus}.`);
    }
  }

  const blockedActivation = validateExpeditionStatusTransition(
    firstActivation.state,
    "expedition-002",
    "active",
  );

  if (blockedActivation.status !== "active-limit-reached") {
    errors.push("A second active expedition must exceed the active limit.");
  }

  const completion = applyExpeditionStatusTransition(
    firstActivation.state,
    "expedition-001",
    "completed",
  );

  if (completion.status !== "transitioned") {
    errors.push("An active expedition must transition to completed.");
  }

  for (const terminalStatus of ["completed", "failed", "cancelled"] as const) {
    const terminalRecord: ExpeditionRecord = Object.freeze({
      ...firstActivation.expedition,
      status: terminalStatus,
    });
    const terminalState: ExpeditionState = Object.freeze({
      expeditions: Object.freeze([
        terminalRecord,
        ...firstActivation.state.expeditions.filter(
          (expedition) => expedition.id !== terminalRecord.id,
        ),
      ]),
    });

    if (
      validateExpeditionStatusTransition(
        terminalState,
        terminalRecord.id,
        "active",
      ).status !== "invalid-transition"
    ) {
      errors.push(`${terminalStatus} expeditions must reject transitions.`);
    }
  }

  if (
    validateExpeditionStatusTransition(
      firstActivation.state,
      "unknown-expedition",
      "active",
    ).status !== "unknown-expedition"
  ) {
    errors.push("Unknown expedition IDs must return a safe failure.");
  }

  if (
    applyExpeditionStatusTransition(
      firstActivation.state,
      "unknown-expedition",
      "active",
    ).status !== "unknown-expedition"
  ) {
    errors.push("Applying a transition to an unknown ID must fail safely.");
  }

  if (
    !isExpeditionStatusTerminal("completed") ||
    !isExpeditionStatusTerminal("failed") ||
    !isExpeditionStatusTerminal("cancelled") ||
    isExpeditionStatusTerminal("planned") ||
    isExpeditionStatusTerminal("active")
  ) {
    errors.push("Terminal status detection is incorrect.");
  }

  return finishDomainValidation(
    errors,
    expeditionCountBeforeValidation,
    expeditionCountAfterValidation,
    firstPlan.state.expeditions.length,
    revealedTileCountBefore,
    countRevealedTiles(world),
  );
}

function finishDomainValidation(
  errors: string[],
  expeditionCountBeforeValidation: number,
  expeditionCountAfterValidation: number,
  expeditionCountAfterPlanning: number,
  revealedTileCountBefore: number,
  revealedTileCountAfter: number,
): ExpeditionDomainValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    expeditionCountBeforeValidation,
    expeditionCountAfterValidation,
    expeditionCountAfterPlanning,
    revealedTileCountBefore,
    revealedTileCountAfter,
  };
}
