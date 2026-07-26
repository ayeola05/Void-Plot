import { DEFAULT_INITIAL_MATERIALS } from "../data";

export type MaterialAmount = number;

export interface MaterialsState {
  materials: MaterialAmount;
}

export type CreateMaterialsStateResult =
  | {
      status: "created";
      state: MaterialsState;
    }
  | {
      status: "invalid-initial-materials";
      initialMaterials: number;
    };

export type MaterialAmountValidationResult =
  | {
      valid: true;
      status: "valid";
      amount: MaterialAmount;
    }
  | {
      valid: false;
      status: "invalid-amount";
      amount: number;
    };

export type MaterialsStateValidationResult =
  | {
      valid: true;
      status: "valid";
      balance: MaterialAmount;
    }
  | {
      valid: false;
      status: "invalid-state";
      balance: number;
    };

export type MaterialsAffordabilityResult =
  | {
      canAfford: true;
      status: "affordable";
      amount: MaterialAmount;
      balance: MaterialAmount;
    }
  | {
      canAfford: false;
      status: "insufficient-materials";
      amount: MaterialAmount;
      balance: MaterialAmount;
      shortfall: MaterialAmount;
    }
  | {
      canAfford: false;
      status: "invalid-amount";
      amount: number;
    }
  | {
      canAfford: false;
      status: "invalid-state";
      balance: number;
    };

export type MaterialsDebitResult =
  | {
      status: "spent";
      amount: MaterialAmount;
      previousBalance: MaterialAmount;
      balance: MaterialAmount;
    }
  | {
      status: "insufficient-materials";
      amount: MaterialAmount;
      balance: MaterialAmount;
      shortfall: MaterialAmount;
    }
  | {
      status: "invalid-amount";
      amount: number;
    }
  | {
      status: "invalid-state";
      balance: number;
    };

export type MaterialsCreditResult =
  | {
      status: "added";
      amount: MaterialAmount;
      previousBalance: MaterialAmount;
      balance: MaterialAmount;
    }
  | {
      status: "invalid-amount";
      amount: number;
    }
  | {
      status: "invalid-state";
      balance: number;
    };

export interface MaterialsFoundationValidationResult {
  valid: boolean;
  errors: string[];
  defaultInitialBalance: number;
  debitBalanceBefore: number;
  debitBalanceAfter: number;
  creditBalanceBefore: number;
  creditBalanceAfter: number;
  failedOperationBalanceBefore: number;
  failedOperationBalanceAfter: number;
}

export function createMaterialsState(
  initialMaterials: number = DEFAULT_INITIAL_MATERIALS,
): CreateMaterialsStateResult {
  if (!isValidMaterialsBalance(initialMaterials)) {
    return {
      status: "invalid-initial-materials",
      initialMaterials,
    };
  }

  return {
    status: "created",
    state: { materials: initialMaterials },
  };
}

export function validateMaterialAmount(
  amount: number,
): MaterialAmountValidationResult {
  return isPositiveFiniteInteger(amount)
    ? { valid: true, status: "valid", amount }
    : { valid: false, status: "invalid-amount", amount };
}

export function validateMaterialsState(
  state: MaterialsState,
): MaterialsStateValidationResult {
  return isValidMaterialsBalance(state.materials)
    ? { valid: true, status: "valid", balance: state.materials }
    : { valid: false, status: "invalid-state", balance: state.materials };
}

export function isMaterialsStateValid(state: MaterialsState): boolean {
  return validateMaterialsState(state).valid;
}

export function getMaterialsBalance(state: MaterialsState): MaterialAmount {
  return state.materials;
}

export function canAffordMaterials(
  state: MaterialsState,
  amount: number,
): MaterialsAffordabilityResult {
  const stateValidation = validateMaterialsState(state);

  if (!stateValidation.valid) {
    return { status: "invalid-state", canAfford: false, balance: state.materials };
  }

  const amountValidation = validateMaterialAmount(amount);

  if (!amountValidation.valid) {
    return { status: "invalid-amount", canAfford: false, amount };
  }

  if (state.materials < amountValidation.amount) {
    return {
      status: "insufficient-materials",
      canAfford: false,
      amount: amountValidation.amount,
      balance: state.materials,
      shortfall: amountValidation.amount - state.materials,
    };
  }

  return {
    status: "affordable",
    canAfford: true,
    amount: amountValidation.amount,
    balance: state.materials,
  };
}

/** Mutates `state` only when the returned status is `spent`. */
export function spendMaterials(
  state: MaterialsState,
  amount: number,
): MaterialsDebitResult {
  const affordability = canAffordMaterials(state, amount);

  switch (affordability.status) {
    case "invalid-state":
      return { status: "invalid-state", balance: affordability.balance };
    case "invalid-amount":
      return { status: "invalid-amount", amount: affordability.amount };
    case "insufficient-materials":
      return {
        status: "insufficient-materials",
        amount: affordability.amount,
        balance: affordability.balance,
        shortfall: affordability.shortfall,
      };
    case "affordable": {
      const previousBalance = state.materials;
      state.materials = previousBalance - affordability.amount;

      return {
        status: "spent",
        amount: affordability.amount,
        previousBalance,
        balance: state.materials,
      };
    }
  }
}

/** Mutates `state` only when the returned status is `added`. */
export function addMaterials(
  state: MaterialsState,
  amount: number,
): MaterialsCreditResult {
  const stateValidation = validateMaterialsState(state);

  if (!stateValidation.valid) {
    return { status: "invalid-state", balance: state.materials };
  }

  const amountValidation = validateMaterialAmount(amount);

  if (!amountValidation.valid) {
    return { status: "invalid-amount", amount };
  }

  const nextBalance = state.materials + amountValidation.amount;

  if (!isValidMaterialsBalance(nextBalance)) {
    return { status: "invalid-amount", amount };
  }

  const previousBalance = state.materials;
  state.materials = nextBalance;

  return {
    status: "added",
    amount: amountValidation.amount,
    previousBalance,
    balance: state.materials,
  };
}

function isPositiveFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isValidMaterialsBalance(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function validateMaterialsFoundation(): MaterialsFoundationValidationResult {
  const errors: string[] = [];
  const defaultResult = createMaterialsState();
  const customResult = createMaterialsState(75);
  const defaultInitialBalance =
    defaultResult.status === "created" ? defaultResult.state.materials : NaN;

  if (
    defaultResult.status !== "created" ||
    defaultResult.state.materials !== DEFAULT_INITIAL_MATERIALS
  ) {
    errors.push("The default materials balance must be 200.");
  }

  if (customResult.status !== "created" || customResult.state.materials !== 75) {
    errors.push("A valid custom initial balance must be preserved.");
  }

  if (createMaterialsState(0).status !== "created") {
    errors.push("A zero initial balance must be valid.");
  }

  for (const invalidInitialValue of [-1, 1.5, NaN, Infinity, -Infinity]) {
    if (
      createMaterialsState(invalidInitialValue).status !==
      "invalid-initial-materials"
    ) {
      errors.push(`Invalid initial value ${invalidInitialValue} was accepted.`);
    }
  }

  const debitState = { materials: 200 };
  const debitBalanceBefore = debitState.materials;
  const debitResult = spendMaterials(debitState, 50);
  const debitBalanceAfter = debitState.materials;

  if (debitResult.status !== "spent" || debitBalanceAfter !== 150) {
    errors.push("A successful debit must mutate 200 materials to 150.");
  }

  const exactBalanceState = { materials: 40 };

  if (
    spendMaterials(exactBalanceState, 40).status !== "spent" ||
    exactBalanceState.materials !== 0
  ) {
    errors.push("An exact-balance debit must leave zero materials.");
  }

  const failedState = { materials: 10 };
  const failedOperationBalanceBefore = failedState.materials;
  const insufficientResult = spendMaterials(failedState, 11);

  if (
    insufficientResult.status !== "insufficient-materials" ||
    failedState.materials !== failedOperationBalanceBefore
  ) {
    errors.push("An insufficient debit must not mutate materials.");
  }

  if (
    canAffordMaterials(failedState, 10).status !== "affordable" ||
    canAffordMaterials(failedState, 11).status !== "insufficient-materials" ||
    canAffordMaterials(failedState, 0).status !== "invalid-amount"
  ) {
    errors.push("Affordability checks must report explicit safe statuses.");
  }

  for (const invalidAmount of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    const balanceBeforeDebit = failedState.materials;
    const debit = spendMaterials(failedState, invalidAmount);
    const balanceBeforeCredit = failedState.materials;
    const credit = addMaterials(failedState, invalidAmount);

    if (
      debit.status !== "invalid-amount" ||
      credit.status !== "invalid-amount" ||
      failedState.materials !== balanceBeforeDebit ||
      failedState.materials !== balanceBeforeCredit
    ) {
      errors.push(`Invalid operation amount ${invalidAmount} was not safe.`);
    }
  }

  const creditState = { materials: 10 };
  const creditBalanceBefore = creditState.materials;
  const creditResult = addMaterials(creditState, 25);
  const creditBalanceAfter = creditState.materials;

  if (creditResult.status !== "added" || creditBalanceAfter !== 35) {
    errors.push("A successful credit must mutate 10 materials to 35.");
  }

  const invalidState = { materials: -1 };

  if (
    spendMaterials(invalidState, 1).status !== "invalid-state" ||
    addMaterials(invalidState, 1).status !== "invalid-state" ||
    invalidState.materials !== -1
  ) {
    errors.push("Operations on an invalid state must fail without mutation.");
  }

  const failedOperationBalanceAfter = failedState.materials;

  return {
    valid: errors.length === 0,
    errors,
    defaultInitialBalance,
    debitBalanceBefore,
    debitBalanceAfter,
    creditBalanceBefore,
    creditBalanceAfter,
    failedOperationBalanceBefore,
    failedOperationBalanceAfter,
  };
}
