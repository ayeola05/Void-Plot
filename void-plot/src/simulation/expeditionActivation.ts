import { MAX_ACTIVE_EXPEDITIONS } from "../data";
import {
  countRevealedTiles,
  createWorld,
  sectorContainsHiddenTile,
  validateExpeditionSectorSelection,
  type TileCoordinate,
  type WorldState,
} from "../world";
import {
  applyExpeditionStatusTransition,
  countActiveExpeditions,
  createExpeditionState,
  createPlannedExpedition,
  findExpeditionById,
  validateExpeditionStatusTransition,
  type ExpeditionId,
  type ExpeditionRecord,
  type ExpeditionState,
  type ExpeditionTiming,
} from "./expedition";
import {
  canAffordMaterials,
  spendMaterials,
  validateMaterialsState,
  type MaterialsState,
} from "./materials";
import {
  assignWorkers,
  canAssignWorkers,
  validateWorkersState,
  type WorkersState,
} from "./workers";

export type ExpeditionActivationStatus =
  | "ready"
  | "activated"
  | "expedition-not-found"
  | "expedition-not-planned"
  | "invalid-sector"
  | "sector-no-longer-has-hidden-tiles"
  | "active-expedition-limit-reached"
  | "invalid-materials-state"
  | "insufficient-materials"
  | "invalid-workers-state"
  | "insufficient-workers"
  | "invalid-transition"
  | "invalid-clock-value";

export interface ExpeditionActivationClock {
  now: () => number;
}

export interface ExpeditionActivationSnapshot {
  readonly expeditionId: ExpeditionId;
  readonly previousStatus: "planned";
  readonly previousTiming: ExpeditionTiming;
  readonly materialsBalanceBefore: number;
  readonly workersBefore: Readonly<WorkersState>;
  readonly hiddenCoordinatesAtStart: readonly Readonly<TileCoordinate>[];
}

export interface ExpeditionActivationPlan {
  readonly expedition: ExpeditionRecord;
  readonly materialsRequired: number;
  readonly workersRequired: number;
  readonly startTimestampMilliseconds: number;
  readonly expectedCompletionTimestampMilliseconds: number;
  readonly hiddenCoordinatesAtStart: readonly Readonly<TileCoordinate>[];
}

export type ExpeditionActivationFailure =
  | {
      readonly status: "expedition-not-found";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "expedition-not-planned";
      readonly expeditionId: ExpeditionId;
      readonly currentStatus: ExpeditionRecord["status"];
    }
  | {
      readonly status: "invalid-sector";
      readonly expeditionId: ExpeditionId;
      readonly reason: "out-of-bounds" | "not-adjacent";
    }
  | {
      readonly status: "sector-no-longer-has-hidden-tiles";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "active-expedition-limit-reached";
      readonly expeditionId: ExpeditionId;
      readonly maximumActiveExpeditions: number;
    }
  | {
      readonly status: "invalid-materials-state";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "insufficient-materials";
      readonly expeditionId: ExpeditionId;
      readonly required: number;
      readonly available: number;
    }
  | {
      readonly status: "invalid-workers-state";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "insufficient-workers";
      readonly expeditionId: ExpeditionId;
      readonly required: number;
      readonly available: number;
    }
  | {
      readonly status: "invalid-transition";
      readonly expeditionId: ExpeditionId;
    }
  | {
      readonly status: "invalid-clock-value";
      readonly expeditionId: ExpeditionId;
      readonly clockValue: number;
    };

export type ExpeditionActivationValidationResult =
  | {
      readonly status: "ready";
      readonly plan: ExpeditionActivationPlan;
    }
  | ExpeditionActivationFailure;

export type ExpeditionActivationOperationResult =
  | {
      readonly status: "activated";
      readonly expeditionState: ExpeditionState;
      readonly materialsState: MaterialsState;
      readonly workersState: WorkersState;
      readonly expedition: ExpeditionRecord;
      readonly activationSnapshot: ExpeditionActivationSnapshot;
      readonly materialsSpent: number;
      readonly workersAssigned: number;
      readonly startTimestampMilliseconds: number;
      readonly expectedCompletionTimestampMilliseconds: number;
    }
  | ExpeditionActivationFailure;

export interface ExpeditionActivationFoundationValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly expeditionStatusBefore: ExpeditionRecord["status"];
  readonly expeditionStatusAfter: ExpeditionRecord["status"];
  readonly materialsBalanceBefore: number;
  readonly materialsBalanceAfter: number;
  readonly workersStateBefore: WorkersState;
  readonly workersStateAfter: WorkersState;
  readonly failureCasesPreservedAllInputs: boolean;
  readonly revealedTileCountBefore: number;
  readonly revealedTileCountAfter: number;
}

export function isValidActivationClockValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function calculateExpectedCompletionTimestamp(
  startTimestampMilliseconds: number,
  durationSeconds: number,
): number | undefined {
  if (
    !isValidActivationClockValue(startTimestampMilliseconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return undefined;
  }

  const completionTimestamp =
    startTimestampMilliseconds + durationSeconds * 1_000;

  return isValidActivationClockValue(completionTimestamp)
    ? completionTimestamp
    : undefined;
}

export function validateExpeditionActivation(
  world: WorldState,
  expeditionState: ExpeditionState,
  materialsState: MaterialsState,
  workersState: WorkersState,
  expeditionId: ExpeditionId,
  startTimestampMilliseconds: number,
): ExpeditionActivationValidationResult {
  const expedition = findExpeditionById(expeditionState, expeditionId);

  if (expedition === undefined) {
    return { status: "expedition-not-found", expeditionId };
  }

  if (expedition.status !== "planned") {
    return {
      status: "expedition-not-planned",
      expeditionId,
      currentStatus: expedition.status,
    };
  }

  const sector = validateExpeditionSectorSelection(
    world,
    expedition.sector.origin,
    expedition.sector.size,
  );

  if (sector.status === "out-of-bounds" || sector.status === "not-adjacent") {
    return { status: "invalid-sector", expeditionId, reason: sector.status };
  }

  if (
    sector.status === "already-fully-revealed" ||
    !sectorContainsHiddenTile(
      world,
      expedition.sector.origin,
      expedition.sector.size,
    )
  ) {
    return { status: "sector-no-longer-has-hidden-tiles", expeditionId };
  }

  if (countActiveExpeditions(expeditionState) >= MAX_ACTIVE_EXPEDITIONS) {
    return {
      status: "active-expedition-limit-reached",
      expeditionId,
      maximumActiveExpeditions: MAX_ACTIVE_EXPEDITIONS,
    };
  }

  if (!validateMaterialsState(materialsState).valid) {
    return { status: "invalid-materials-state", expeditionId };
  }

  const affordability = canAffordMaterials(
    materialsState,
    expedition.requirements.materialCost,
  );

  if (affordability.status === "invalid-state" || affordability.status === "invalid-amount") {
    return { status: "invalid-materials-state", expeditionId };
  }

  if (affordability.status === "insufficient-materials") {
    return {
      status: "insufficient-materials",
      expeditionId,
      required: expedition.requirements.materialCost,
      available: materialsState.materials,
    };
  }

  if (!validateWorkersState(workersState).valid) {
    return { status: "invalid-workers-state", expeditionId };
  }

  const availability = canAssignWorkers(
    workersState,
    expedition.requirements.requiredWorkers,
  );

  if (availability.status === "invalid-state" || availability.status === "invalid-count") {
    return { status: "invalid-workers-state", expeditionId };
  }

  if (availability.status === "insufficient-workers") {
    return {
      status: "insufficient-workers",
      expeditionId,
      required: expedition.requirements.requiredWorkers,
      available: workersState.availableWorkers,
    };
  }

  const transition = validateExpeditionStatusTransition(
    expeditionState,
    expeditionId,
    "active",
  );

  if (transition.status !== "valid") {
    return transition.status === "active-limit-reached"
      ? {
          status: "active-expedition-limit-reached",
          expeditionId,
          maximumActiveExpeditions: transition.maximumActiveExpeditions,
        }
      : { status: "invalid-transition", expeditionId };
  }

  const expectedCompletionTimestampMilliseconds =
    calculateExpectedCompletionTimestamp(
      startTimestampMilliseconds,
      expedition.timing.durationSeconds,
    );

  if (expectedCompletionTimestampMilliseconds === undefined) {
    return {
      status: "invalid-clock-value",
      expeditionId,
      clockValue: startTimestampMilliseconds,
    };
  }

  return {
    status: "ready",
    plan: Object.freeze({
      expedition,
      materialsRequired: expedition.requirements.materialCost,
      workersRequired: expedition.requirements.requiredWorkers,
      startTimestampMilliseconds,
      expectedCompletionTimestampMilliseconds,
      hiddenCoordinatesAtStart: freezeCoordinates(sector.hiddenCoordinates),
    }),
  };
}

export function activateExpedition(
  world: WorldState,
  expeditionState: ExpeditionState,
  materialsState: MaterialsState,
  workersState: WorkersState,
  expeditionId: ExpeditionId,
  clock: ExpeditionActivationClock,
): ExpeditionActivationOperationResult {
  const prerequisiteValidation = validateExpeditionActivation(
    world,
    expeditionState,
    materialsState,
    workersState,
    expeditionId,
    0,
  );

  if (prerequisiteValidation.status !== "ready") {
    return prerequisiteValidation;
  }

  let startTimestampMilliseconds: number;

  try {
    startTimestampMilliseconds = clock.now();
  } catch {
    return {
      status: "invalid-clock-value",
      expeditionId,
      clockValue: NaN,
    };
  }

  const validation = validateExpeditionActivation(
    world,
    expeditionState,
    materialsState,
    workersState,
    expeditionId,
    startTimestampMilliseconds,
  );

  if (validation.status !== "ready") {
    return validation;
  }

  const nextMaterialsState = { ...materialsState };
  const nextWorkersState = { ...workersState };
  const debit = spendMaterials(
    nextMaterialsState,
    validation.plan.materialsRequired,
  );
  const assignment = assignWorkers(
    nextWorkersState,
    validation.plan.workersRequired,
  );
  const transition = applyExpeditionStatusTransition(
    expeditionState,
    expeditionId,
    "active",
  );

  if (debit.status !== "spent") {
    return debit.status === "insufficient-materials"
      ? {
          status: "insufficient-materials",
          expeditionId,
          required: validation.plan.materialsRequired,
          available: materialsState.materials,
        }
      : { status: "invalid-materials-state", expeditionId };
  }

  if (assignment.status !== "assigned") {
    return assignment.status === "insufficient-workers"
      ? {
          status: "insufficient-workers",
          expeditionId,
          required: validation.plan.workersRequired,
          available: workersState.availableWorkers,
        }
      : { status: "invalid-workers-state", expeditionId };
  }

  if (transition.status !== "transitioned") {
    return transition.status === "active-limit-reached"
      ? {
          status: "active-expedition-limit-reached",
          expeditionId,
          maximumActiveExpeditions: transition.maximumActiveExpeditions,
        }
      : { status: "invalid-transition", expeditionId };
  }

  const activationSnapshot: ExpeditionActivationSnapshot = Object.freeze({
    expeditionId,
    previousStatus: "planned",
    previousTiming: Object.freeze({ ...validation.plan.expedition.timing }),
    materialsBalanceBefore: materialsState.materials,
    workersBefore: Object.freeze({ ...workersState }),
    hiddenCoordinatesAtStart: validation.plan.hiddenCoordinatesAtStart,
  });
  const activatedExpedition: ExpeditionRecord = Object.freeze({
    ...transition.expedition,
    sector: Object.freeze({
      ...transition.expedition.sector,
      hiddenCoordinatesAtStart: validation.plan.hiddenCoordinatesAtStart,
    }),
    timing: Object.freeze({
      ...transition.expedition.timing,
      elapsedSeconds: 0,
      startedAtMilliseconds: validation.plan.startTimestampMilliseconds,
      expectedCompletionAtMilliseconds:
        validation.plan.expectedCompletionTimestampMilliseconds,
    }),
  });
  const nextExpeditionState: ExpeditionState = Object.freeze({
    expeditions: Object.freeze(
      transition.state.expeditions.map((expedition) =>
        expedition.id === expeditionId ? activatedExpedition : expedition,
      ),
    ),
  });

  return {
    status: "activated",
    expeditionState: nextExpeditionState,
    materialsState: nextMaterialsState,
    workersState: nextWorkersState,
    expedition: activatedExpedition,
    activationSnapshot,
    materialsSpent: validation.plan.materialsRequired,
    workersAssigned: validation.plan.workersRequired,
    startTimestampMilliseconds: validation.plan.startTimestampMilliseconds,
    expectedCompletionTimestampMilliseconds:
      validation.plan.expectedCompletionTimestampMilliseconds,
  };
}

function freezeCoordinates(
  coordinates: readonly TileCoordinate[],
): readonly Readonly<TileCoordinate>[] {
  return Object.freeze(
    coordinates.map((coordinate) => Object.freeze({ ...coordinate })),
  );
}

interface ActivationFixture {
  world: WorldState;
  expeditionState: ExpeditionState;
  materialsState: MaterialsState;
  workersState: WorkersState;
  expeditionId: ExpeditionId;
}

interface InputSnapshot {
  expeditionState: string;
  materialsState: string;
  workersState: string;
  revealedTiles: number;
}

export function validateExpeditionActivationFoundation(): ExpeditionActivationFoundationValidationResult {
  const errors: string[] = [];
  const fixture = createActivationFixture();

  if (fixture === undefined) {
    return {
      valid: false,
      errors: ["Could not create the activation validation fixture."],
      expeditionStatusBefore: "planned",
      expeditionStatusAfter: "planned",
      materialsBalanceBefore: 0,
      materialsBalanceAfter: 0,
      workersStateBefore: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      workersStateAfter: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      failureCasesPreservedAllInputs: false,
      revealedTileCountBefore: 0,
      revealedTileCountAfter: 0,
    };
  }

  const expeditionBefore = findExpeditionById(
    fixture.expeditionState,
    fixture.expeditionId,
  );

  if (expeditionBefore === undefined) {
    return {
      valid: false,
      errors: ["The activation fixture expedition is missing."],
      expeditionStatusBefore: "planned",
      expeditionStatusAfter: "planned",
      materialsBalanceBefore: fixture.materialsState.materials,
      materialsBalanceAfter: fixture.materialsState.materials,
      workersStateBefore: { ...fixture.workersState },
      workersStateAfter: { ...fixture.workersState },
      failureCasesPreservedAllInputs: false,
      revealedTileCountBefore: countRevealedTiles(fixture.world),
      revealedTileCountAfter: countRevealedTiles(fixture.world),
    };
  }

  const expeditionStatusBefore = expeditionBefore.status;
  const materialsBalanceBefore = fixture.materialsState.materials;
  const workersStateBefore = { ...fixture.workersState };
  const revealedTileCountBefore = countRevealedTiles(fixture.world);
  const success = activateExpedition(
    fixture.world,
    fixture.expeditionState,
    fixture.materialsState,
    fixture.workersState,
    fixture.expeditionId,
    { now: () => 1_000 },
  );

  if (
    success.status !== "activated" ||
    success.expedition.status !== "active" ||
    success.materialsState.materials !== 180 ||
    success.workersState.totalWorkers !== 4 ||
    success.workersState.availableWorkers !== 3 ||
    success.workersState.assignedWorkers !== 1 ||
    success.startTimestampMilliseconds !== 1_000 ||
    success.expectedCompletionTimestampMilliseconds !== 31_000 ||
    success.expedition.timing.durationSeconds !== 30
  ) {
    errors.push("A 2×2 expedition must activate with correct atomic next state.");
  }

  if (
    fixture.materialsState.materials !== materialsBalanceBefore ||
    JSON.stringify(fixture.workersState) !== JSON.stringify(workersStateBefore) ||
    findExpeditionById(fixture.expeditionState, fixture.expeditionId)?.status !==
      expeditionStatusBefore
  ) {
    errors.push("Successful activation must not partially mutate its input states.");
  }

  const exactMaterialsFixture = createActivationFixture(20, 4);
  const exactWorkersFixture = createActivationFixture(200, 1);

  if (
    exactMaterialsFixture === undefined ||
    !activationUsesExactMaterials(exactMaterialsFixture)
  ) {
    errors.push("Activation with exact materials must succeed.");
  }

  if (exactWorkersFixture === undefined) {
    errors.push("Could not create the exact-worker activation fixture.");
  } else {
    const exactWorkersResult = activateExpedition(
      exactWorkersFixture.world,
      exactWorkersFixture.expeditionState,
      exactWorkersFixture.materialsState,
      exactWorkersFixture.workersState,
      exactWorkersFixture.expeditionId,
      { now: () => 0 },
    );

    if (
      exactWorkersResult.status !== "activated" ||
      exactWorkersResult.workersState.availableWorkers !== 0
    ) {
      errors.push("Activation with the exact available workers must succeed.");
    }
  }

  const failureChecks: boolean[] = [];
  failureChecks.push(
    expectFailureWithoutMutation(fixture, "expedition-not-found", "missing", 0),
  );

  const cancelledState = applyExpeditionStatusTransition(
    fixture.expeditionState,
    fixture.expeditionId,
    "cancelled",
  );

  if (cancelledState.status === "transitioned") {
    failureChecks.push(
      expectFailureWithoutMutation(
        { ...fixture, expeditionState: cancelledState.state },
        "expedition-not-planned",
        fixture.expeditionId,
        0,
      ),
    );
  } else {
    errors.push("Could not prepare the non-planned activation fixture.");
  }

  const staleWorld = cloneWorld(fixture.world);
  for (const tile of staleWorld.tiles) {
    tile.revealState = "hidden";
  }
  failureChecks.push(
    expectFailureWithoutMutation(
      { ...fixture, world: staleWorld },
      "invalid-sector",
      fixture.expeditionId,
      0,
    ),
  );

  const fullyRevealedWorld = cloneWorld(fixture.world);
  for (const coordinate of expeditionBefore.sector.coveredCoordinates) {
    const tile = fullyRevealedWorld.tiles.find(
      (candidate) => candidate.x === coordinate.x && candidate.y === coordinate.y,
    );
    if (tile !== undefined) {
      tile.revealState = "revealed";
    }
  }
  failureChecks.push(
    expectFailureWithoutMutation(
      { ...fixture, world: fullyRevealedWorld },
      "sector-no-longer-has-hidden-tiles",
      fixture.expeditionId,
      0,
    ),
  );

  const limitFixture = createActiveLimitFixture();
  if (limitFixture === undefined) {
    errors.push("Could not prepare the active-limit fixture.");
  } else {
    failureChecks.push(
      expectFailureWithoutMutation(
        limitFixture,
        "active-expedition-limit-reached",
        limitFixture.expeditionId,
        0,
      ),
    );
  }

  failureChecks.push(
    expectFailureWithoutMutation(
      { ...fixture, materialsState: { materials: 19 } },
      "insufficient-materials",
      fixture.expeditionId,
      0,
    ),
    expectFailureWithoutMutation(
      { ...fixture, materialsState: { materials: -1 } },
      "invalid-materials-state",
      fixture.expeditionId,
      0,
    ),
    expectFailureWithoutMutation(
      {
        ...fixture,
        workersState: { totalWorkers: 0, availableWorkers: 0, assignedWorkers: 0 },
      },
      "insufficient-workers",
      fixture.expeditionId,
      0,
    ),
    expectFailureWithoutMutation(
      {
        ...fixture,
        workersState: { totalWorkers: 4, availableWorkers: 4, assignedWorkers: 1 },
      },
      "invalid-workers-state",
      fixture.expeditionId,
      0,
    ),
  );

  for (const invalidClock of [-1, NaN, Infinity, -Infinity]) {
    failureChecks.push(
      expectFailureWithoutMutation(
        fixture,
        "invalid-clock-value",
        fixture.expeditionId,
        invalidClock,
      ),
    );
  }

  const beforeThrowingClock = snapshotInputs(fixture);
  const throwingClockResult = activateExpedition(
    fixture.world,
    fixture.expeditionState,
    fixture.materialsState,
    fixture.workersState,
    fixture.expeditionId,
    {
      now: () => {
        throw new Error("validation clock failure");
      },
    },
  );
  const afterThrowingClock = snapshotInputs(fixture);
  failureChecks.push(
    throwingClockResult.status === "invalid-clock-value" &&
      snapshotsMatch(beforeThrowingClock, afterThrowingClock),
  );

  if (!failureChecks.every(Boolean)) {
    errors.push("At least one failure status or no-mutation check failed.");
  }

  const failureCasesPreservedAllInputs = failureChecks.every(Boolean);
  const expeditionStatusAfter =
    success.status === "activated" ? success.expedition.status : expeditionStatusBefore;
  const materialsBalanceAfter =
    success.status === "activated"
      ? success.materialsState.materials
      : materialsBalanceBefore;
  const workersStateAfter =
    success.status === "activated"
      ? { ...success.workersState }
      : { ...workersStateBefore };
  const revealedTileCountAfter = countRevealedTiles(fixture.world);

  return {
    valid: errors.length === 0,
    errors,
    expeditionStatusBefore,
    expeditionStatusAfter,
    materialsBalanceBefore,
    materialsBalanceAfter,
    workersStateBefore,
    workersStateAfter,
    failureCasesPreservedAllInputs,
    revealedTileCountBefore,
    revealedTileCountAfter,
  };
}

function createActivationFixture(
  materials = 200,
  workers = 4,
): ActivationFixture | undefined {
  const world = createWorld();
  const plan = createPlannedExpedition(
    world,
    createExpeditionState(),
    { x: 10, y: 12 },
    2,
    () => "expedition-activation-001",
  );

  if (plan.status !== "planned") {
    return undefined;
  }

  return {
    world,
    expeditionState: plan.state,
    materialsState: { materials },
    workersState: {
      totalWorkers: workers,
      availableWorkers: workers,
      assignedWorkers: 0,
    },
    expeditionId: plan.expedition.id,
  };
}

function activationUsesExactMaterials(fixture: ActivationFixture): boolean {
  const result = activateExpedition(
    fixture.world,
    fixture.expeditionState,
    fixture.materialsState,
    fixture.workersState,
    fixture.expeditionId,
    { now: () => 0 },
  );

  return result.status === "activated" && result.materialsState.materials === 0;
}

function createActiveLimitFixture(): ActivationFixture | undefined {
  const first = createActivationFixture();

  if (first === undefined) {
    return undefined;
  }

  const secondPlan = createPlannedExpedition(
    first.world,
    first.expeditionState,
    { x: 10, y: 14 },
    2,
    () => "expedition-activation-002",
  );

  if (secondPlan.status !== "planned") {
    return undefined;
  }

  const firstActive = applyExpeditionStatusTransition(
    secondPlan.state,
    first.expeditionId,
    "active",
  );

  if (firstActive.status !== "transitioned") {
    return undefined;
  }

  return {
    ...first,
    expeditionState: firstActive.state,
    expeditionId: secondPlan.expedition.id,
  };
}

function expectFailureWithoutMutation(
  fixture: ActivationFixture,
  expectedStatus: ExpeditionActivationFailure["status"],
  expeditionId: ExpeditionId,
  clockValue: number,
): boolean {
  const before = snapshotInputs(fixture);
  const result = activateExpedition(
    fixture.world,
    fixture.expeditionState,
    fixture.materialsState,
    fixture.workersState,
    expeditionId,
    { now: () => clockValue },
  );
  const after = snapshotInputs(fixture);

  return result.status === expectedStatus && snapshotsMatch(before, after);
}

function snapshotInputs(fixture: ActivationFixture): InputSnapshot {
  return {
    expeditionState: JSON.stringify(fixture.expeditionState),
    materialsState: JSON.stringify(fixture.materialsState),
    workersState: JSON.stringify(fixture.workersState),
    revealedTiles: countRevealedTiles(fixture.world),
  };
}

function snapshotsMatch(first: InputSnapshot, second: InputSnapshot): boolean {
  return (
    first.expeditionState === second.expeditionState &&
    first.materialsState === second.materialsState &&
    first.workersState === second.workersState &&
    first.revealedTiles === second.revealedTiles
  );
}

function cloneWorld(world: WorldState): WorldState {
  return {
    width: world.width,
    height: world.height,
    tiles: world.tiles.map((tile) => ({ ...tile })),
  };
}
