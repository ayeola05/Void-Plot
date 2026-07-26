import {
  countRevealedTiles,
  createWorld,
  revealTiles,
  type ExpeditionSectorOrigin,
  type ExpeditionSectorSize,
  type TileCoordinate,
  type WorldState,
} from "../world";
import {
  applyExpeditionStatusTransition,
  createExpeditionState,
  createPlannedExpedition,
  findExpeditionById,
  getExpeditionRequirements,
  type CreatePlannedExpeditionResult,
  type ExpeditionId,
  type ExpeditionIdFactory,
  type ExpeditionRecord,
  type ExpeditionState,
} from "./expedition";
import {
  activateExpedition,
  isValidActivationClockValue,
  validateExpeditionActivation,
  type ExpeditionActivationClock,
  type ExpeditionActivationFailure,
} from "./expeditionActivation";
import {
  createMaterialsState,
  type MaterialsState,
} from "./materials";
import {
  createWorkersState,
  releaseWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";

export interface ExpeditionLaunchSector {
  readonly origin: Readonly<ExpeditionSectorOrigin>;
  readonly size: ExpeditionSectorSize;
}

export type ExpeditionLaunchAvailabilityResult =
  | {
      readonly status: "ready";
      readonly requirements: ReturnType<typeof getExpeditionRequirements>;
    }
  | {
      readonly status: "no-sector-selected";
    }
  | {
      readonly status: "planning-blocked";
      readonly reason: Exclude<
        CreatePlannedExpeditionResult["status"],
        "planned" | "duplicate-id"
      >;
      readonly requirements: ReturnType<typeof getExpeditionRequirements>;
    }
  | {
      readonly status: "activation-blocked";
      readonly reason: ExpeditionActivationFailure["status"];
      readonly requirements: ReturnType<typeof getExpeditionRequirements>;
    };

export type StartExpeditionFromSectorResult =
  | {
      readonly status: "activated";
      readonly expeditionState: ExpeditionState;
      readonly materialsState: MaterialsState;
      readonly workersState: WorkersState;
      readonly expedition: ExpeditionRecord;
    }
  | {
      readonly status: "planning-failed";
      readonly reason: Exclude<CreatePlannedExpeditionResult["status"], "planned">;
    }
  | {
      readonly status: "activation-failed";
      readonly reason: ExpeditionActivationFailure["status"];
      readonly expeditionState: ExpeditionState;
      readonly plannedExpedition: ExpeditionRecord;
    };

export interface ExpeditionCountdownSnapshot {
  readonly expedition: ExpeditionRecord;
  readonly remainingSeconds: number;
  readonly progress: number;
}

export type AdvanceExpeditionResult =
  | {
      readonly status: "no-active-expedition";
    }
  | {
      readonly status: "in-progress";
      readonly countdown: ExpeditionCountdownSnapshot;
    }
  | {
      readonly status: "completed";
      readonly expeditionState: ExpeditionState;
      readonly workersState: WorkersState;
      readonly expedition: ExpeditionRecord;
      readonly revealedCoordinates: readonly Readonly<TileCoordinate>[];
      readonly newlyRevealedCount: number;
      readonly alreadyRevealedCount: number;
      readonly workersReleased: number;
    }
  | {
      readonly status: "invalid-clock-value";
    }
  | {
      readonly status: "invalid-active-expedition";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "invalid-workers-state";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "insufficient-assigned-workers";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "completion-transition-failed";
      readonly expeditionId: ExpeditionId;
    };

export interface ExpeditionGameplayFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly revealedTileCountBefore: number;
  readonly revealedTileCountAfter: number;
  readonly materialsBefore: number;
  readonly materialsAfterStart: number;
  readonly workersBefore: WorkersState;
  readonly workersDuring: WorkersState;
  readonly workersAfter: WorkersState;
  readonly failedStartsPreservedInputs: boolean;
  readonly duplicateCompletionWasSafe: boolean;
}

export function validateExpeditionLaunchAvailability(
  world: WorldState,
  expeditionState: ExpeditionState,
  materialsState: MaterialsState,
  workersState: WorkersState,
  sector?: ExpeditionLaunchSector,
  modifiers: { readonly materialCostMultiplier?: number; readonly durationMultiplier?: number } = {},
): ExpeditionLaunchAvailabilityResult {
  if (sector === undefined) {
    return { status: "no-sector-selected" };
  }

  const requirements = getExpeditionRequirements(sector.size, modifiers);
  const validationId = createUnusedValidationId(expeditionState);
  const planning = createPlannedExpedition(
    world,
    expeditionState,
    sector.origin,
    sector.size,
    () => validationId,
    modifiers,
  );

  if (planning.status !== "planned") {
    return planning.status === "duplicate-id"
      ? {
          status: "activation-blocked",
          reason: "invalid-transition",
          requirements,
        }
      : {
          status: "planning-blocked",
          reason: planning.status,
          requirements,
        };
  }

  const activation = validateExpeditionActivation(
    world,
    planning.state,
    materialsState,
    workersState,
    planning.expedition.id,
    0,
  );

  return activation.status === "ready"
    ? { status: "ready", requirements }
    : {
        status: "activation-blocked",
        reason: activation.status,
        requirements,
      };
}

export function startExpeditionFromSector(
  world: WorldState,
  expeditionState: ExpeditionState,
  materialsState: MaterialsState,
  workersState: WorkersState,
  sector: ExpeditionLaunchSector,
  idFactory: ExpeditionIdFactory,
  clock: ExpeditionActivationClock,
  modifiers: { readonly materialCostMultiplier?: number; readonly durationMultiplier?: number } = {},
): StartExpeditionFromSectorResult {
  const planning = createPlannedExpedition(
    world,
    expeditionState,
    sector.origin,
    sector.size,
    idFactory,
    modifiers,
  );

  if (planning.status !== "planned") {
    return {
      status: "planning-failed",
      reason: planning.status,
    };
  }

  const activation = activateExpedition(
    world,
    planning.state,
    materialsState,
    workersState,
    planning.expedition.id,
    clock,
  );

  if (activation.status !== "activated") {
    return {
      status: "activation-failed",
      reason: activation.status,
      expeditionState: planning.state,
      plannedExpedition: planning.expedition,
    };
  }

  return {
    status: "activated",
    expeditionState: activation.expeditionState,
    materialsState: activation.materialsState,
    workersState: activation.workersState,
    expedition: activation.expedition,
  };
}

export function getActiveExpedition(
  state: ExpeditionState,
): ExpeditionRecord | undefined {
  return state.expeditions.find((expedition) => expedition.status === "active");
}

export function getExpeditionCountdown(
  expedition: ExpeditionRecord,
  currentTimestampMilliseconds: number,
): ExpeditionCountdownSnapshot | undefined {
  const startedAt = expedition.timing.startedAtMilliseconds;
  const expectedCompletion = expedition.timing.expectedCompletionAtMilliseconds;

  if (
    expedition.status !== "active" ||
    startedAt === undefined ||
    expectedCompletion === undefined ||
    !isValidActivationClockValue(currentTimestampMilliseconds) ||
    !isValidActivationClockValue(startedAt) ||
    !isValidActivationClockValue(expectedCompletion) ||
    expectedCompletion < startedAt
  ) {
    return undefined;
  }

  const durationMilliseconds = expectedCompletion - startedAt;
  const remainingMilliseconds = Math.max(
    0,
    expectedCompletion - currentTimestampMilliseconds,
  );
  const progress =
    durationMilliseconds === 0
      ? 1
      : Math.min(
          1,
          Math.max(0, (currentTimestampMilliseconds - startedAt) / durationMilliseconds),
        );

  return {
    expedition,
    remainingSeconds: Math.ceil(remainingMilliseconds / 1_000),
    progress,
  };
}

export function advanceActiveExpedition(
  world: WorldState,
  expeditionState: ExpeditionState,
  workersState: WorkersState,
  currentTimestampMilliseconds: number,
): AdvanceExpeditionResult {
  if (!isValidActivationClockValue(currentTimestampMilliseconds)) {
    return { status: "invalid-clock-value" };
  }

  const activeExpedition = getActiveExpedition(expeditionState);

  if (activeExpedition === undefined) {
    return { status: "no-active-expedition" };
  }

  const countdown = getExpeditionCountdown(
    activeExpedition,
    currentTimestampMilliseconds,
  );

  if (countdown === undefined) {
    return {
      status: "invalid-active-expedition",
      expeditionId: activeExpedition.id,
    };
  }

  if (countdown.remainingSeconds > 0) {
    return { status: "in-progress", countdown };
  }

  return completeExpeditionSuccessfully(
    world,
    expeditionState,
    workersState,
    activeExpedition.id,
  );
}

export function completeExpeditionSuccessfully(
  world: WorldState,
  expeditionState: ExpeditionState,
  workersState: WorkersState,
  expeditionId: ExpeditionId,
): AdvanceExpeditionResult {
  const expedition = findExpeditionById(expeditionState, expeditionId);

  if (expedition === undefined || expedition.status !== "active") {
    return {
      status: "invalid-active-expedition",
      expeditionId,
    };
  }

  const hiddenCoordinatesAtStart = expedition.sector.hiddenCoordinatesAtStart;

  if (hiddenCoordinatesAtStart === undefined) {
    return {
      status: "invalid-active-expedition",
      expeditionId,
    };
  }

  if (!validateWorkersState(workersState).valid) {
    return { status: "invalid-workers-state", expeditionId };
  }

  if (workersState.assignedWorkers < expedition.requirements.requiredWorkers) {
    return { status: "insufficient-assigned-workers", expeditionId };
  }

  const transition = applyExpeditionStatusTransition(
    expeditionState,
    expeditionId,
    "completed",
  );

  if (transition.status !== "transitioned") {
    return { status: "completion-transition-failed", expeditionId };
  }

  const nextWorkersState = { ...workersState };
  const release = releaseWorkers(
    nextWorkersState,
    expedition.requirements.requiredWorkers,
  );

  if (release.status !== "released") {
    return release.status === "exceeds-assigned-workers"
      ? { status: "insufficient-assigned-workers", expeditionId }
      : { status: "invalid-workers-state", expeditionId };
  }

  const reveal = revealTiles(world, hiddenCoordinatesAtStart);

  return {
    status: "completed",
    expeditionState: transition.state,
    workersState: nextWorkersState,
    expedition: transition.expedition,
    revealedCoordinates: hiddenCoordinatesAtStart.map((coordinate) => ({
      ...coordinate,
    })),
    newlyRevealedCount: reveal.newlyRevealedCount,
    alreadyRevealedCount: reveal.alreadyRevealedCount,
    workersReleased: release.count,
  };
}

function createUnusedValidationId(state: ExpeditionState): ExpeditionId {
  let suffix = state.expeditions.length;
  let candidate = `__expedition-launch-validation-${suffix}`;

  while (findExpeditionById(state, candidate) !== undefined) {
    suffix += 1;
    candidate = `__expedition-launch-validation-${suffix}`;
  }

  return candidate;
}

export function validateExpeditionGameplayFoundation(): ExpeditionGameplayFoundationValidationResult {
  const errors: string[] = [];
  const world = createWorld();
  const materialsResult = createMaterialsState();
  const workersResult = createWorkersState();
  const revealedTileCountBefore = countRevealedTiles(world);

  if (materialsResult.status !== "created" || workersResult.status !== "created") {
    return {
      valid: false,
      errors: ["Could not create default expedition gameplay resources."],
      revealedTileCountBefore,
      revealedTileCountAfter: revealedTileCountBefore,
      materialsBefore: 0,
      materialsAfterStart: 0,
      workersBefore: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      workersDuring: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      workersAfter: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      failedStartsPreservedInputs: false,
      duplicateCompletionWasSafe: false,
    };
  }

  const initialExpeditionState = createExpeditionState();
  const materialsBefore = materialsResult.state.materials;
  const workersBefore = { ...workersResult.state };
  const start = startExpeditionFromSector(
    world,
    initialExpeditionState,
    materialsResult.state,
    workersResult.state,
    { origin: { x: 10, y: 12 }, size: 2 },
    () => "gameplay-validation-001",
    { now: () => 1_000 },
  );

  if (start.status !== "activated") {
    errors.push("A valid 2×2 expedition must start successfully.");
    return {
      valid: false,
      errors,
      revealedTileCountBefore,
      revealedTileCountAfter: countRevealedTiles(world),
      materialsBefore,
      materialsAfterStart: materialsResult.state.materials,
      workersBefore,
      workersDuring: { ...workersResult.state },
      workersAfter: { ...workersResult.state },
      failedStartsPreservedInputs: false,
      duplicateCompletionWasSafe: false,
    };
  }

  const workersDuring = { ...start.workersState };

  if (
    start.materialsState.materials !== 180 ||
    workersDuring.availableWorkers !== 3 ||
    workersDuring.assignedWorkers !== 1 ||
    countRevealedTiles(world) !== revealedTileCountBefore
  ) {
    errors.push("Starting must spend materials and assign workers without revealing.");
  }

  const midCountdown = advanceActiveExpedition(
    world,
    start.expeditionState,
    start.workersState,
    16_000,
  );

  if (
    midCountdown.status !== "in-progress" ||
    midCountdown.countdown.remainingSeconds !== 15 ||
    midCountdown.countdown.progress !== 0.5
  ) {
    errors.push("Countdown timing must derive correctly from scene timestamps.");
  }

  const completion = advanceActiveExpedition(
    world,
    start.expeditionState,
    start.workersState,
    31_000,
  );

  if (
    completion.status !== "completed" ||
    completion.expedition.status !== "completed" ||
    completion.newlyRevealedCount !== 4 ||
    completion.workersReleased !== 1
  ) {
    errors.push("Countdown completion must reveal the sector and release workers.");
  }

  const workersAfter =
    completion.status === "completed"
      ? { ...completion.workersState }
      : { ...start.workersState };
  const revealedAfterFirstCompletion = countRevealedTiles(world);
  const duplicateCompletion =
    completion.status === "completed"
      ? completeExpeditionSuccessfully(
          world,
          completion.expeditionState,
          completion.workersState,
          completion.expedition.id,
        )
      : undefined;
  const duplicateCompletionWasSafe =
    duplicateCompletion?.status === "invalid-active-expedition" &&
    countRevealedTiles(world) === revealedAfterFirstCompletion &&
    workersAfter.availableWorkers === 4 &&
    workersAfter.assignedWorkers === 0;

  if (!duplicateCompletionWasSafe) {
    errors.push("A completed expedition must not reveal or release twice.");
  }

  const failureChecks = [
    validateFailedStartPreservesInputs(19, 4, "insufficient-materials"),
    validateFailedStartPreservesInputs(200, 0, "insufficient-workers"),
    validateActiveLimitRejection(),
  ];
  const failedStartsPreservedInputs = failureChecks.every(Boolean);

  if (!failedStartsPreservedInputs) {
    errors.push("Failed starts must preserve supplied expedition, material, and worker states.");
  }

  return {
    valid: errors.length === 0,
    errors,
    revealedTileCountBefore,
    revealedTileCountAfter: countRevealedTiles(world),
    materialsBefore,
    materialsAfterStart: start.materialsState.materials,
    workersBefore,
    workersDuring,
    workersAfter,
    failedStartsPreservedInputs,
    duplicateCompletionWasSafe,
  };
}

function validateFailedStartPreservesInputs(
  materials: number,
  availableWorkers: number,
  expectedReason: ExpeditionActivationFailure["status"],
): boolean {
  const world = createWorld();
  const expeditionState = createExpeditionState();
  const materialsState = { materials };
  const workersState = {
    totalWorkers: availableWorkers,
    availableWorkers,
    assignedWorkers: 0,
  };
  const before = JSON.stringify({ expeditionState, materialsState, workersState });
  const result = startExpeditionFromSector(
    world,
    expeditionState,
    materialsState,
    workersState,
    { origin: { x: 10, y: 12 }, size: 2 },
    () => `failed-start-${expectedReason}`,
    { now: () => 0 },
  );
  const after = JSON.stringify({ expeditionState, materialsState, workersState });

  return (
    result.status === "activation-failed" &&
    result.reason === expectedReason &&
    result.plannedExpedition.status === "planned" &&
    before === after &&
    countRevealedTiles(world) === 64
  );
}

function validateActiveLimitRejection(): boolean {
  const world = createWorld();
  const materialsState = { materials: 200 };
  const workersState = { totalWorkers: 4, availableWorkers: 4, assignedWorkers: 0 };
  const first = startExpeditionFromSector(
    world,
    createExpeditionState(),
    materialsState,
    workersState,
    { origin: { x: 10, y: 12 }, size: 2 },
    () => "active-limit-first",
    { now: () => 0 },
  );

  if (first.status !== "activated") {
    return false;
  }

  const stateBefore = JSON.stringify({
    expeditionState: first.expeditionState,
    materialsState: first.materialsState,
    workersState: first.workersState,
  });
  const second = startExpeditionFromSector(
    world,
    first.expeditionState,
    first.materialsState,
    first.workersState,
    { origin: { x: 10, y: 14 }, size: 2 },
    () => "active-limit-second",
    { now: () => 0 },
  );
  const stateAfter = JSON.stringify({
    expeditionState: first.expeditionState,
    materialsState: first.materialsState,
    workersState: first.workersState,
  });

  return (
    second.status === "activation-failed" &&
    second.reason === "active-expedition-limit-reached" &&
    stateBefore === stateAfter
  );
}
