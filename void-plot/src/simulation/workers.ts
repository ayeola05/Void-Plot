import { DEFAULT_INITIAL_WORKERS } from "../data";

export type WorkerCount = number;

export interface WorkersState {
  totalWorkers: WorkerCount;
  availableWorkers: WorkerCount;
  assignedWorkers: WorkerCount;
}

export type CreateWorkersStateResult =
  | {
      status: "created";
      state: WorkersState;
    }
  | {
      status: "invalid-initial-workers";
      initialTotalWorkers: number;
    };

export type WorkerCountValidationResult =
  | {
      valid: true;
      status: "valid";
      count: WorkerCount;
    }
  | {
      valid: false;
      status: "invalid-count";
      count: number;
    };

export type WorkersStateValidationResult =
  | {
      valid: true;
      status: "valid";
    }
  | {
      valid: false;
      status: "invalid-state";
      state: Readonly<WorkersState>;
    };

export type WorkerAvailabilityResult =
  | {
      canAssign: true;
      status: "available";
      count: WorkerCount;
      availableWorkers: WorkerCount;
    }
  | {
      canAssign: false;
      status: "insufficient-workers";
      count: WorkerCount;
      availableWorkers: WorkerCount;
      shortfall: WorkerCount;
    }
  | {
      canAssign: false;
      status: "invalid-count";
      count: number;
    }
  | {
      canAssign: false;
      status: "invalid-state";
    };

export type WorkerAssignmentResult =
  | {
      status: "assigned";
      count: WorkerCount;
      state: Readonly<WorkersState>;
    }
  | {
      status: "insufficient-workers";
      count: WorkerCount;
      availableWorkers: WorkerCount;
      shortfall: WorkerCount;
    }
  | {
      status: "invalid-count";
      count: number;
    }
  | {
      status: "invalid-state";
    };

export type WorkerReleaseResult =
  | {
      status: "released";
      count: WorkerCount;
      state: Readonly<WorkersState>;
    }
  | {
      status: "exceeds-assigned-workers";
      count: WorkerCount;
      assignedWorkers: WorkerCount;
      excess: WorkerCount;
    }
  | {
      status: "invalid-count";
      count: number;
    }
  | {
      status: "invalid-state";
    };

export type WorkerTotalIncreaseResult =
  | {
      readonly status: "worker-added";
      readonly count: WorkerCount;
      readonly state: Readonly<WorkersState>;
    }
  | { readonly status: "invalid-count"; readonly count: number }
  | { readonly status: "invalid-state" }
  | { readonly status: "overflow"; readonly count: WorkerCount };

export interface WorkersFoundationValidationResult {
  valid: boolean;
  errors: string[];
  defaultInitialTotal: number;
  assignmentStateBefore: WorkersState;
  assignmentStateAfter: WorkersState;
  releaseStateBefore: WorkersState;
  releaseStateAfter: WorkersState;
  failedOperationStateBefore: WorkersState;
  failedOperationStateAfter: WorkersState;
  invariantsPreserved: boolean;
}

export function createWorkersState(
  initialTotalWorkers: number = DEFAULT_INITIAL_WORKERS,
): CreateWorkersStateResult {
  if (!isNonNegativeFiniteInteger(initialTotalWorkers)) {
    return {
      status: "invalid-initial-workers",
      initialTotalWorkers,
    };
  }

  return {
    status: "created",
    state: {
      totalWorkers: initialTotalWorkers,
      availableWorkers: initialTotalWorkers,
      assignedWorkers: 0,
    },
  };
}

export function validateWorkerCount(
  count: number,
): WorkerCountValidationResult {
  return isPositiveFiniteInteger(count)
    ? { valid: true, status: "valid", count }
    : { valid: false, status: "invalid-count", count };
}

export function validateWorkersState(
  state: WorkersState,
): WorkersStateValidationResult {
  const valid =
    isNonNegativeFiniteInteger(state.totalWorkers) &&
    isNonNegativeFiniteInteger(state.availableWorkers) &&
    isNonNegativeFiniteInteger(state.assignedWorkers) &&
    state.availableWorkers + state.assignedWorkers === state.totalWorkers;

  return valid
    ? { valid: true, status: "valid" }
    : {
        valid: false,
        status: "invalid-state",
        state: { ...state },
      };
}

export function isWorkersStateValid(state: WorkersState): boolean {
  return validateWorkersState(state).valid;
}

export function getTotalWorkers(state: WorkersState): WorkerCount {
  return state.totalWorkers;
}

export function getAvailableWorkers(state: WorkersState): WorkerCount {
  return state.availableWorkers;
}

export function getAssignedWorkers(state: WorkersState): WorkerCount {
  return state.assignedWorkers;
}

export function canAssignWorkers(
  state: WorkersState,
  count: number,
): WorkerAvailabilityResult {
  if (!validateWorkersState(state).valid) {
    return { canAssign: false, status: "invalid-state" };
  }

  const countValidation = validateWorkerCount(count);

  if (!countValidation.valid) {
    return { canAssign: false, status: "invalid-count", count };
  }

  if (countValidation.count > state.availableWorkers) {
    return {
      canAssign: false,
      status: "insufficient-workers",
      count: countValidation.count,
      availableWorkers: state.availableWorkers,
      shortfall: countValidation.count - state.availableWorkers,
    };
  }

  return {
    canAssign: true,
    status: "available",
    count: countValidation.count,
    availableWorkers: state.availableWorkers,
  };
}

/** Mutates `state` only when the returned status is `assigned`. */
export function assignWorkers(
  state: WorkersState,
  count: number,
): WorkerAssignmentResult {
  const availability = canAssignWorkers(state, count);

  switch (availability.status) {
    case "invalid-state":
      return { status: "invalid-state" };
    case "invalid-count":
      return { status: "invalid-count", count: availability.count };
    case "insufficient-workers":
      return {
        status: "insufficient-workers",
        count: availability.count,
        availableWorkers: availability.availableWorkers,
        shortfall: availability.shortfall,
      };
    case "available": {
      const nextAvailableWorkers =
        state.availableWorkers - availability.count;
      const nextAssignedWorkers = state.assignedWorkers + availability.count;

      state.availableWorkers = nextAvailableWorkers;
      state.assignedWorkers = nextAssignedWorkers;

      return {
        status: "assigned",
        count: availability.count,
        state: { ...state },
      };
    }
  }
}

/** Mutates `state` only when the returned status is `released`. */
export function releaseWorkers(
  state: WorkersState,
  count: number,
): WorkerReleaseResult {
  if (!validateWorkersState(state).valid) {
    return { status: "invalid-state" };
  }

  const countValidation = validateWorkerCount(count);

  if (!countValidation.valid) {
    return { status: "invalid-count", count };
  }

  if (countValidation.count > state.assignedWorkers) {
    return {
      status: "exceeds-assigned-workers",
      count: countValidation.count,
      assignedWorkers: state.assignedWorkers,
      excess: countValidation.count - state.assignedWorkers,
    };
  }

  const nextAvailableWorkers = state.availableWorkers + countValidation.count;
  const nextAssignedWorkers = state.assignedWorkers - countValidation.count;

  state.availableWorkers = nextAvailableWorkers;
  state.assignedWorkers = nextAssignedWorkers;

  return {
    status: "released",
    count: countValidation.count,
    state: { ...state },
  };
}

/** Mutates `state` only when the returned status is `worker-added`. */
export function increaseTotalWorkers(
  state: WorkersState,
  count: number,
): WorkerTotalIncreaseResult {
  if (!validateWorkersState(state).valid) {
    return { status: "invalid-state" };
  }

  const countValidation = validateWorkerCount(count);

  if (!countValidation.valid) {
    return { status: "invalid-count", count };
  }

  const totalWorkers = state.totalWorkers + countValidation.count;
  const availableWorkers = state.availableWorkers + countValidation.count;

  if (
    !Number.isSafeInteger(totalWorkers) ||
    !Number.isSafeInteger(availableWorkers) ||
    availableWorkers + state.assignedWorkers !== totalWorkers
  ) {
    return { status: "overflow", count: countValidation.count };
  }

  state.totalWorkers = totalWorkers;
  state.availableWorkers = availableWorkers;

  return {
    status: "worker-added",
    count: countValidation.count,
    state: { ...state },
  };
}

function isPositiveFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isNonNegativeFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function validateWorkersFoundation(): WorkersFoundationValidationResult {
  const errors: string[] = [];
  const defaultResult = createWorkersState();
  const customResult = createWorkersState(7);
  const zeroResult = createWorkersState(0);
  const defaultInitialTotal =
    defaultResult.status === "created" ? defaultResult.state.totalWorkers : NaN;

  if (
    defaultResult.status !== "created" ||
    defaultResult.state.totalWorkers !== 4 ||
    defaultResult.state.availableWorkers !== 4 ||
    defaultResult.state.assignedWorkers !== 0
  ) {
    errors.push("The default worker state must be 4 total, 4 available, 0 assigned.");
  }

  if (
    customResult.status !== "created" ||
    customResult.state.totalWorkers !== 7 ||
    customResult.state.availableWorkers !== 7 ||
    customResult.state.assignedWorkers !== 0
  ) {
    errors.push("A valid custom total must initialize all workers as available.");
  }

  if (
    zeroResult.status !== "created" ||
    zeroResult.state.totalWorkers !== 0 ||
    zeroResult.state.availableWorkers !== 0 ||
    zeroResult.state.assignedWorkers !== 0
  ) {
    errors.push("A zero-worker state must be valid.");
  }

  for (const invalidInitialValue of [-1, 1.5, NaN, Infinity, -Infinity]) {
    if (
      createWorkersState(invalidInitialValue).status !==
      "invalid-initial-workers"
    ) {
      errors.push(`Invalid initial worker value ${invalidInitialValue} was accepted.`);
    }
  }

  const assignmentState = {
    totalWorkers: 4,
    availableWorkers: 4,
    assignedWorkers: 0,
  };
  const assignmentStateBefore = { ...assignmentState };
  const assignmentResult = assignWorkers(assignmentState, 2);
  const assignmentStateAfter = { ...assignmentState };

  if (
    assignmentResult.status !== "assigned" ||
    assignmentState.totalWorkers !== 4 ||
    assignmentState.availableWorkers !== 2 ||
    assignmentState.assignedWorkers !== 2
  ) {
    errors.push("Assigning two workers must produce 4 total, 2 available, 2 assigned.");
  }

  const exactAssignmentState = {
    totalWorkers: 3,
    availableWorkers: 3,
    assignedWorkers: 0,
  };

  if (
    assignWorkers(exactAssignmentState, 3).status !== "assigned" ||
    exactAssignmentState.availableWorkers !== 0 ||
    exactAssignmentState.assignedWorkers !== 3
  ) {
    errors.push("Assigning the exact available count must succeed.");
  }

  const failedOperationState = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const failedOperationStateBefore = { ...failedOperationState };

  if (
    assignWorkers(failedOperationState, 2).status !== "insufficient-workers" ||
    !statesMatch(failedOperationState, failedOperationStateBefore)
  ) {
    errors.push("An insufficient assignment must not mutate worker state.");
  }

  const releaseState = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const releaseStateBefore = { ...releaseState };
  const releaseResult = releaseWorkers(releaseState, 2);
  const releaseStateAfter = { ...releaseState };

  if (
    releaseResult.status !== "released" ||
    releaseState.totalWorkers !== 4 ||
    releaseState.availableWorkers !== 3 ||
    releaseState.assignedWorkers !== 1
  ) {
    errors.push("Releasing two workers must produce 4 total, 3 available, 1 assigned.");
  }

  const exactReleaseState = {
    totalWorkers: 4,
    availableWorkers: 0,
    assignedWorkers: 4,
  };

  if (
    releaseWorkers(exactReleaseState, 4).status !== "released" ||
    exactReleaseState.availableWorkers !== 4 ||
    exactReleaseState.assignedWorkers !== 0
  ) {
    errors.push("Releasing the exact assigned count must succeed.");
  }

  if (
    releaseWorkers(failedOperationState, 4).status !==
      "exceeds-assigned-workers" ||
    !statesMatch(failedOperationState, failedOperationStateBefore)
  ) {
    errors.push("An over-release must not mutate worker state.");
  }

  const increaseState = {
    totalWorkers: 4,
    availableWorkers: 1,
    assignedWorkers: 3,
  };
  const increaseResult = increaseTotalWorkers(increaseState, 1);

  if (
    increaseResult.status !== "worker-added" ||
    increaseState.totalWorkers !== 5 ||
    increaseState.availableWorkers !== 2 ||
    increaseState.assignedWorkers !== 3 ||
    !isWorkersStateValid(increaseState)
  ) {
    errors.push("Increasing total workers must preserve assignments and invariants.");
  }

  const failedIncreaseBefore = { ...increaseState };
  if (
    increaseTotalWorkers(increaseState, 0).status !== "invalid-count" ||
    !statesMatch(increaseState, failedIncreaseBefore)
  ) {
    errors.push("A failed total-worker increase must not mutate worker state.");
  }

  const overflowState = {
    totalWorkers: Number.MAX_SAFE_INTEGER,
    availableWorkers: Number.MAX_SAFE_INTEGER,
    assignedWorkers: 0,
  };
  const overflowStateBefore = { ...overflowState };
  if (
    increaseTotalWorkers(overflowState, 1).status !== "overflow" ||
    !statesMatch(overflowState, overflowStateBefore)
  ) {
    errors.push("An overflowing total-worker increase must fail without mutation.");
  }

  for (const invalidCount of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    const stateBeforeAssignment = { ...failedOperationState };
    const assignment = assignWorkers(failedOperationState, invalidCount);
    const stateBeforeRelease = { ...failedOperationState };
    const release = releaseWorkers(failedOperationState, invalidCount);
    const stateBeforeIncrease = { ...failedOperationState };
    const increase = increaseTotalWorkers(failedOperationState, invalidCount);

    if (
      assignment.status !== "invalid-count" ||
      release.status !== "invalid-count" ||
      increase.status !== "invalid-count" ||
      !statesMatch(failedOperationState, stateBeforeAssignment) ||
      !statesMatch(failedOperationState, stateBeforeRelease) ||
      !statesMatch(failedOperationState, stateBeforeIncrease)
    ) {
      errors.push(`Invalid worker count ${invalidCount} was not safe.`);
    }
  }

  const invalidState = {
    totalWorkers: 4,
    availableWorkers: 3,
    assignedWorkers: 2,
  };
  const invalidStateBefore = { ...invalidState };

  if (
    assignWorkers(invalidState, 1).status !== "invalid-state" ||
    releaseWorkers(invalidState, 1).status !== "invalid-state" ||
    increaseTotalWorkers(invalidState, 1).status !== "invalid-state" ||
    !statesMatch(invalidState, invalidStateBefore)
  ) {
    errors.push("Operations on an invalid state must fail without mutation.");
  }

  const statesToCheck = [
    assignmentState,
    exactAssignmentState,
    failedOperationState,
    releaseState,
    exactReleaseState,
  ];
  const invariantsPreserved = statesToCheck.every(isWorkersStateValid);

  if (!invariantsPreserved) {
    errors.push("Successful and failed operations must preserve worker invariants.");
  }

  const failedOperationStateAfter = { ...failedOperationState };

  return {
    valid: errors.length === 0,
    errors,
    defaultInitialTotal,
    assignmentStateBefore,
    assignmentStateAfter,
    releaseStateBefore,
    releaseStateAfter,
    failedOperationStateBefore,
    failedOperationStateAfter,
    invariantsPreserved,
  };
}

function statesMatch(first: WorkersState, second: WorkersState): boolean {
  return (
    first.totalWorkers === second.totalWorkers &&
    first.availableWorkers === second.availableWorkers &&
    first.assignedWorkers === second.assignedWorkers
  );
}
