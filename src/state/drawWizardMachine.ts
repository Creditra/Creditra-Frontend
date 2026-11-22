import { CreditLine, DrawStep, Transaction } from "@/types/draw-credit.types";
import { normalizeCreditLineAvailability } from "@/lib/credit-line-availability";
import { DrawIneligibilityReason } from "@/lib/draw-eligibility";
import { DrawErrorKind } from "@/lib/draw-errors";
import { getDrawAmountValidation } from "@/utils/amountValidation";

/**
 * Full state representation of the multi-step draw credit wizard.
 */
export interface DrawWizardState {
  step: DrawStep;
  selectedCreditLine: CreditLine | null;
  amount: number;
  isLoading: boolean;
  confirmationAcknowledged: boolean;
  eligibilityAlert: DrawIneligibilityReason | null;
  submitError: string | null;
  transaction: Transaction | null;
  errorKind: DrawErrorKind | undefined;
  isOfflineBlocked: boolean;
  draftNotice: string;
}

/**
 * Strongly typed events supported by the Draw Wizard state machine.
 */
export type DrawWizardEvent =
  | { type: "SELECT_LINE"; line: CreditLine }
  | { type: "SET_AMOUNT"; amount: number }
  | { type: "PROCEED_TO_CONFIRM"; amount?: number }
  | { type: "SET_CONFIRMATION_ACKNOWLEDGED"; acknowledged: boolean }
  | { type: "SET_ELIGIBILITY_ALERT"; reason: DrawIneligibilityReason | null }
  | { type: "SET_SUBMIT_ERROR"; error: string | null }
  | { type: "CLEAR_SUBMIT_ERROR" }
  | { type: "EDIT_AMOUNT_FROM_ERROR" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; transaction: Transaction }
  | { type: "SUBMIT_ERROR"; transaction: Transaction; errorKind?: DrawErrorKind }
  | { type: "SUBMIT_OFFLINE_BLOCKED" }
  | { type: "BACK" }
  | { type: "RETRY"; targetStep?: DrawStep }
  | { type: "RESET" }
  | { type: "OFFLINE_BACK_TO_REVIEW" }
  | { type: "RESTORE_DRAFT"; step: DrawStep; line: CreditLine | null; amount: number; notice?: string }
  | { type: "SET_DRAFT_NOTICE"; notice: string }
  | { type: "CLEAR_DRAFT_NOTICE" };

/**
 * Creates the initial wizard state with optional partial overrides.
 */
export function createInitialDrawWizardState(
  init?: Partial<DrawWizardState>,
): DrawWizardState {
  return {
    step: "select",
    selectedCreditLine: null,
    amount: 0,
    isLoading: false,
    confirmationAcknowledged: false,
    eligibilityAlert: null,
    submitError: null,
    transaction: null,
    errorKind: undefined,
    isOfflineBlocked: false,
    draftNotice: "",
    ...init,
  };
}

/**
 * Pure reducer governing the multi-step draw wizard state machine.
 *
 * Invariants enforced:
 * - Illegal transitions are strictly ignored (returns current state reference).
 * - Concurrent double submissions are impossible: SUBMIT_START is rejected if
 *   isLoading is true or step is not "confirm".
 * - Step progression is sequential: select -> amount -> confirm -> status.
 * - BACK moves back exactly one step from amount or confirm, and is ignored during loading.
 * - RESET / Make Another Draw cleanly restores state to select.
 */
export function drawWizardReducer(
  state: DrawWizardState,
  event: DrawWizardEvent,
): DrawWizardState {
  switch (event.type) {
    case "SELECT_LINE": {
      if (state.isLoading) return state;
      if (state.step !== "select" && state.step !== "amount") return state;
      const normalized = normalizeCreditLineAvailability(event.line);
      return {
        ...state,
        step: "amount",
        selectedCreditLine: normalized,
        amount: 0,
        confirmationAcknowledged: false,
        eligibilityAlert: null,
        submitError: null,
        isOfflineBlocked: false,
      };
    }

    case "SET_AMOUNT": {
      if (state.isLoading || state.step !== "amount") return state;
      if (
        state.amount === event.amount &&
        state.submitError === null &&
        state.eligibilityAlert === null
      ) {
        return state;
      }
      return {
        ...state,
        amount: event.amount,
        eligibilityAlert: null,
        submitError: null,
      };
    }

    case "PROCEED_TO_CONFIRM": {
      if (state.isLoading || state.step !== "amount" || !state.selectedCreditLine) {
        return state;
      }
      const nextAmount =
        typeof event.amount === "number" ? event.amount : state.amount;
      if (nextAmount <= 0) return state;
      return {
        ...state,
        step: "confirm",
        amount: nextAmount,
        eligibilityAlert: null,
        submitError: null,
      };
    }

    case "SET_CONFIRMATION_ACKNOWLEDGED": {
      if (state.step !== "confirm" || state.isLoading) return state;
      return {
        ...state,
        confirmationAcknowledged: event.acknowledged,
      };
    }

    case "SET_ELIGIBILITY_ALERT": {
      return {
        ...state,
        eligibilityAlert: event.reason,
      };
    }

    case "SET_SUBMIT_ERROR": {
      return {
        ...state,
        submitError: event.error,
      };
    }

    case "CLEAR_SUBMIT_ERROR": {
      return {
        ...state,
        submitError: null,
      };
    }

    case "EDIT_AMOUNT_FROM_ERROR": {
      if (state.step !== "confirm" || state.isLoading) return state;
      return {
        ...state,
        step: "amount",
        submitError: null,
        confirmationAcknowledged: false,
      };
    }

    case "SUBMIT_START": {
      if (
        state.isLoading ||
        state.step !== "confirm" ||
        !state.selectedCreditLine ||
        state.amount <= 0
      ) {
        return state;
      }
      return {
        ...state,
        isLoading: true,
        step: "status",
        isOfflineBlocked: false,
        submitError: null,
        eligibilityAlert: null,
      };
    }

    case "SUBMIT_SUCCESS": {
      if (!state.isLoading || state.step !== "status") return state;
      return {
        ...state,
        isLoading: false,
        transaction: event.transaction,
        errorKind: undefined,
      };
    }

    case "SUBMIT_ERROR": {
      if (!state.isLoading || state.step !== "status") return state;
      return {
        ...state,
        isLoading: false,
        transaction: event.transaction,
        errorKind: event.errorKind,
      };
    }

    case "SUBMIT_OFFLINE_BLOCKED": {
      if (!state.isLoading && !state.isOfflineBlocked) return state;
      return {
        ...state,
        isLoading: false,
        isOfflineBlocked: true,
      };
    }

    case "OFFLINE_BACK_TO_REVIEW": {
      if (state.step !== "status" || !state.isOfflineBlocked || state.isLoading) {
        return state;
      }
      return {
        ...state,
        step: "confirm",
        isOfflineBlocked: false,
      };
    }

    case "BACK": {
      if (state.isLoading) return state;
      if (state.step === "amount") {
        return {
          ...state,
          step: "select",
          selectedCreditLine: null,
          confirmationAcknowledged: false,
          eligibilityAlert: null,
          submitError: null,
        };
      }
      if (state.step === "confirm") {
        return {
          ...state,
          step: "amount",
          confirmationAcknowledged: false,
          eligibilityAlert: null,
          submitError: null,
        };
      }
      return state;
    }

    case "RETRY": {
      if (state.isLoading || state.step !== "status") return state;
      if (!state.selectedCreditLine) {
        return {
          ...state,
          step: "select",
          confirmationAcknowledged: false,
          transaction: null,
          errorKind: undefined,
          submitError: null,
        };
      }
      if (event.targetStep) {
        return {
          ...state,
          step: event.targetStep,
          confirmationAcknowledged: false,
          transaction: null,
          errorKind: undefined,
          submitError: null,
        };
      }
      const validation = getDrawAmountValidation(
        String(state.amount),
        state.selectedCreditLine,
      );
      return {
        ...state,
        step: validation.isValid ? "confirm" : "amount",
        confirmationAcknowledged: false,
        transaction: null,
        errorKind: undefined,
        submitError: null,
      };
    }

    case "RESET": {
      if (state.isLoading) return state;
      return {
        ...state,
        step: "select",
        selectedCreditLine: null,
        amount: 0,
        isLoading: false,
        confirmationAcknowledged: false,
        eligibilityAlert: null,
        submitError: null,
        transaction: null,
        errorKind: undefined,
        isOfflineBlocked: false,
      };
    }

    case "RESTORE_DRAFT": {
      if (state.isLoading) return state;
      return {
        ...state,
        step: event.step,
        selectedCreditLine: event.line,
        amount: event.amount,
        draftNotice: event.notice ?? state.draftNotice,
      };
    }

    case "SET_DRAFT_NOTICE": {
      return {
        ...state,
        draftNotice: event.notice,
      };
    }

    case "CLEAR_DRAFT_NOTICE": {
      return {
        ...state,
        draftNotice: "",
      };
    }

    default:
      return state;
  }
}
