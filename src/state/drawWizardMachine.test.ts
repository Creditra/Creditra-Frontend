import { describe, it, expect } from "vitest";
import {
  createInitialDrawWizardState,
  drawWizardReducer,
  DrawWizardState,
  DrawWizardEvent,
} from "./drawWizardMachine";
import { CreditLine, Transaction } from "@/types/draw-credit.types";

const mockLine: CreditLine = {
  id: "cl-001",
  name: "Business Line of Credit",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard",
  termMonths: 24,
  status: "Active",
};

const mockTransaction: Transaction = {
  id: "TXN-123",
  creditLineId: "cl-001",
  amount: 1000,
  status: "success",
  timestamp: new Date("2026-11-22T12:00:00Z"),
};

describe("drawWizardMachine", () => {
  describe("createInitialDrawWizardState", () => {
    it("returns correct default values", () => {
      const state = createInitialDrawWizardState();
      expect(state).toEqual({
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
      });
    });

    it("applies overrides when provided", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 500,
      });
      expect(state.step).toBe("amount");
      expect(state.selectedCreditLine).toEqual(mockLine);
      expect(state.amount).toBe(500);
    });
  });

  describe("SELECT_LINE", () => {
    it("transitions from select to amount and normalizes line availability", () => {
      const initial = createInitialDrawWizardState();
      const next = drawWizardReducer(initial, {
        type: "SELECT_LINE",
        line: mockLine,
      });

      expect(next.step).toBe("amount");
      expect(next.selectedCreditLine?.id).toBe("cl-001");
      expect(next.amount).toBe(0);
      expect(next.confirmationAcknowledged).toBe(false);
      expect(next.eligibilityAlert).toBeNull();
      expect(next.submitError).toBeNull();
    });

    it("allows switching lines on the amount step", () => {
      const initial = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      const next = drawWizardReducer(initial, {
        type: "SELECT_LINE",
        line: { ...mockLine, id: "cl-002", name: "Equipment Line" },
      });

      expect(next.step).toBe("amount");
      expect(next.selectedCreditLine?.id).toBe("cl-002");
      expect(next.amount).toBe(0);
    });

    it("ignores SELECT_LINE when on confirm or status step", () => {
      const onConfirm = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      expect(
        drawWizardReducer(onConfirm, { type: "SELECT_LINE", line: mockLine }),
      ).toBe(onConfirm);

      const onStatus = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      expect(
        drawWizardReducer(onStatus, { type: "SELECT_LINE", line: mockLine }),
      ).toBe(onStatus);
    });

    it("ignores SELECT_LINE when isLoading is true", () => {
      const loading = createInitialDrawWizardState({
        step: "select",
        isLoading: true,
      });
      expect(
        drawWizardReducer(loading, { type: "SELECT_LINE", line: mockLine }),
      ).toBe(loading);
    });
  });

  describe("SET_AMOUNT", () => {
    it("updates amount on the amount step", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
      });
      const next = drawWizardReducer(state, {
        type: "SET_AMOUNT",
        amount: 1500,
      });
      expect(next.amount).toBe(1500);
      expect(next.eligibilityAlert).toBeNull();
      expect(next.submitError).toBeNull();
    });

    it("ignores SET_AMOUNT when not on the amount step", () => {
      const onSelect = createInitialDrawWizardState({ step: "select" });
      expect(
        drawWizardReducer(onSelect, { type: "SET_AMOUNT", amount: 1500 }),
      ).toBe(onSelect);

      const onConfirm = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      expect(
        drawWizardReducer(onConfirm, { type: "SET_AMOUNT", amount: 1500 }),
      ).toBe(onConfirm);
    });

    it("ignores SET_AMOUNT when isLoading is true", () => {
      const loading = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        isLoading: true,
      });
      expect(
        drawWizardReducer(loading, { type: "SET_AMOUNT", amount: 1500 }),
      ).toBe(loading);
    });
  });

  describe("PROCEED_TO_CONFIRM", () => {
    it("advances from amount to confirm step with valid amount", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      const next = drawWizardReducer(state, {
        type: "PROCEED_TO_CONFIRM",
        amount: 2000,
      });
      expect(next.step).toBe("confirm");
      expect(next.amount).toBe(2000);
      expect(next.submitError).toBeNull();
    });

    it("uses state.amount if event.amount is not provided", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      const next = drawWizardReducer(state, { type: "PROCEED_TO_CONFIRM" });
      expect(next.step).toBe("confirm");
      expect(next.amount).toBe(1000);
    });

    it("ignores PROCEED_TO_CONFIRM if amount is 0 or negative", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 0,
      });
      expect(
        drawWizardReducer(state, { type: "PROCEED_TO_CONFIRM", amount: 0 }),
      ).toBe(state);
      expect(
        drawWizardReducer(state, { type: "PROCEED_TO_CONFIRM", amount: -100 }),
      ).toBe(state);
    });

    it("ignores PROCEED_TO_CONFIRM if no credit line is selected", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: null,
        amount: 1000,
      });
      expect(
        drawWizardReducer(state, { type: "PROCEED_TO_CONFIRM", amount: 1000 }),
      ).toBe(state);
    });

    it("ignores PROCEED_TO_CONFIRM from steps other than amount", () => {
      const onSelect = createInitialDrawWizardState({ step: "select" });
      expect(
        drawWizardReducer(onSelect, { type: "PROCEED_TO_CONFIRM", amount: 1000 }),
      ).toBe(onSelect);

      const onConfirm = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      expect(
        drawWizardReducer(onConfirm, { type: "PROCEED_TO_CONFIRM", amount: 1000 }),
      ).toBe(onConfirm);
    });
  });

  describe("SET_CONFIRMATION_ACKNOWLEDGED", () => {
    it("updates acknowledgement flag on confirm step", () => {
      const state = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      const next = drawWizardReducer(state, {
        type: "SET_CONFIRMATION_ACKNOWLEDGED",
        acknowledged: true,
      });
      expect(next.confirmationAcknowledged).toBe(true);
    });

    it("ignores SET_CONFIRMATION_ACKNOWLEDGED when not on confirm step", () => {
      const onSelect = createInitialDrawWizardState({ step: "select" });
      expect(
        drawWizardReducer(onSelect, {
          type: "SET_CONFIRMATION_ACKNOWLEDGED",
          acknowledged: true,
        }),
      ).toBe(onSelect);
    });
  });

  describe("SUBMIT_START and double submit guard", () => {
    it("transitions from confirm to status with isLoading = true", () => {
      const state = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
        confirmationAcknowledged: true,
      });
      const next = drawWizardReducer(state, { type: "SUBMIT_START" });
      expect(next.step).toBe("status");
      expect(next.isLoading).toBe(true);
      expect(next.isOfflineBlocked).toBe(false);
      expect(next.submitError).toBeNull();
    });

    it("prevents double submission: rejects second SUBMIT_START while loading", () => {
      const inFlightState = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        isLoading: true,
      });
      const duplicateSubmit = drawWizardReducer(inFlightState, {
        type: "SUBMIT_START",
      });
      // Invariant: must return identical object reference
      expect(duplicateSubmit).toBe(inFlightState);
      expect(duplicateSubmit.isLoading).toBe(true);
    });

    it("rejects SUBMIT_START from select or amount step", () => {
      const onSelect = createInitialDrawWizardState({ step: "select" });
      expect(drawWizardReducer(onSelect, { type: "SUBMIT_START" })).toBe(onSelect);

      const onAmount = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      expect(drawWizardReducer(onAmount, { type: "SUBMIT_START" })).toBe(onAmount);
    });

    it("rejects SUBMIT_START without selected credit line or non-positive amount", () => {
      const noLine = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: null,
        amount: 1000,
      });
      expect(drawWizardReducer(noLine, { type: "SUBMIT_START" })).toBe(noLine);

      const zeroAmount = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 0,
      });
      expect(drawWizardReducer(zeroAmount, { type: "SUBMIT_START" })).toBe(zeroAmount);
    });
  });

  describe("SUBMIT_SUCCESS and SUBMIT_ERROR", () => {
    it("records successful transaction and clears isLoading", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        isLoading: true,
      });
      const next = drawWizardReducer(state, {
        type: "SUBMIT_SUCCESS",
        transaction: mockTransaction,
      });
      expect(next.isLoading).toBe(false);
      expect(next.transaction).toEqual(mockTransaction);
      expect(next.errorKind).toBeUndefined();
    });

    it("records failed transaction and errorKind and clears isLoading", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        isLoading: true,
      });
      const failedTx: Transaction = {
        ...mockTransaction,
        status: "error",
        message: "Insufficient funds available",
      };
      const next = drawWizardReducer(state, {
        type: "SUBMIT_ERROR",
        transaction: failedTx,
        errorKind: "insufficient_funds",
      });
      expect(next.isLoading).toBe(false);
      expect(next.transaction).toEqual(failedTx);
      expect(next.errorKind).toBe("insufficient_funds");
    });

    it("ignores SUBMIT_SUCCESS or SUBMIT_ERROR when not loading or not on status step", () => {
      const notLoading = createInitialDrawWizardState({
        step: "status",
        isLoading: false,
      });
      expect(
        drawWizardReducer(notLoading, {
          type: "SUBMIT_SUCCESS",
          transaction: mockTransaction,
        }),
      ).toBe(notLoading);

      const onConfirm = createInitialDrawWizardState({
        step: "confirm",
        isLoading: true,
      });
      expect(
        drawWizardReducer(onConfirm, {
          type: "SUBMIT_SUCCESS",
          transaction: mockTransaction,
        }),
      ).toBe(onConfirm);
    });
  });

  describe("Offline handling", () => {
    it("SUBMIT_OFFLINE_BLOCKED flags offline block and clears isLoading", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        isLoading: true,
      });
      const next = drawWizardReducer(state, { type: "SUBMIT_OFFLINE_BLOCKED" });
      expect(next.isLoading).toBe(false);
      expect(next.isOfflineBlocked).toBe(true);
    });

    it("OFFLINE_BACK_TO_REVIEW returns from offline status to confirm step", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        isOfflineBlocked: true,
      });
      const next = drawWizardReducer(state, { type: "OFFLINE_BACK_TO_REVIEW" });
      expect(next.step).toBe("confirm");
      expect(next.isOfflineBlocked).toBe(false);
    });
  });

  describe("BACK navigation", () => {
    it("navigates back from confirm to amount", () => {
      const state = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
        confirmationAcknowledged: true,
      });
      const next = drawWizardReducer(state, { type: "BACK" });
      expect(next.step).toBe("amount");
      expect(next.selectedCreditLine).toEqual(mockLine);
      expect(next.confirmationAcknowledged).toBe(false);
    });

    it("navigates back from amount to select and clears selectedCreditLine", () => {
      const state = createInitialDrawWizardState({
        step: "amount",
        selectedCreditLine: mockLine,
        amount: 1000,
      });
      const next = drawWizardReducer(state, { type: "BACK" });
      expect(next.step).toBe("select");
      expect(next.selectedCreditLine).toBeNull();
    });

    it("ignores BACK on select and status steps", () => {
      const onSelect = createInitialDrawWizardState({ step: "select" });
      expect(drawWizardReducer(onSelect, { type: "BACK" })).toBe(onSelect);

      const onStatus = createInitialDrawWizardState({ step: "status" });
      expect(drawWizardReducer(onStatus, { type: "BACK" })).toBe(onStatus);
    });

    it("ignores BACK when isLoading is true", () => {
      const loading = createInitialDrawWizardState({
        step: "confirm",
        isLoading: true,
      });
      expect(drawWizardReducer(loading, { type: "BACK" })).toBe(loading);
    });
  });

  describe("RETRY handling", () => {
    it("resets transaction and navigates to confirm for valid amount", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        transaction: { ...mockTransaction, status: "error" },
        errorKind: "network_error",
      });
      const next = drawWizardReducer(state, { type: "RETRY" });
      expect(next.step).toBe("confirm");
      expect(next.transaction).toBeNull();
      expect(next.errorKind).toBeUndefined();
      expect(next.confirmationAcknowledged).toBe(false);
    });

    it("navigates to amount if amount is invalid on retry", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 999999, // over limit
        transaction: { ...mockTransaction, status: "error" },
      });
      const next = drawWizardReducer(state, { type: "RETRY" });
      expect(next.step).toBe("amount");
      expect(next.transaction).toBeNull();
    });

    it("navigates to select if credit line was lost", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: null,
        transaction: { ...mockTransaction, status: "error" },
      });
      const next = drawWizardReducer(state, { type: "RETRY" });
      expect(next.step).toBe("select");
    });

    it("respects explicit targetStep override", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        transaction: { ...mockTransaction, status: "error" },
      });
      const next = drawWizardReducer(state, {
        type: "RETRY",
        targetStep: "amount",
      });
      expect(next.step).toBe("amount");
    });
  });

  describe("RESET handling", () => {
    it("resets wizard completely back to select step", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        selectedCreditLine: mockLine,
        amount: 1000,
        transaction: mockTransaction,
        confirmationAcknowledged: true,
      });
      const next = drawWizardReducer(state, { type: "RESET" });
      expect(next).toEqual(createInitialDrawWizardState());
    });

    it("ignores RESET while submission is in flight", () => {
      const state = createInitialDrawWizardState({
        step: "status",
        isLoading: true,
      });
      expect(drawWizardReducer(state, { type: "RESET" })).toBe(state);
    });
  });

  describe("EDIT_AMOUNT_FROM_ERROR", () => {
    it("returns from confirm error to amount step and clears error", () => {
      const state = createInitialDrawWizardState({
        step: "confirm",
        selectedCreditLine: mockLine,
        amount: 1000,
        submitError: "Exceeds limit",
        confirmationAcknowledged: true,
      });
      const next = drawWizardReducer(state, { type: "EDIT_AMOUNT_FROM_ERROR" });
      expect(next.step).toBe("amount");
      expect(next.submitError).toBeNull();
      expect(next.confirmationAcknowledged).toBe(false);
    });
  });

  describe("Draft persistence & notices", () => {
    it("RESTORE_DRAFT restores saved wizard state", () => {
      const initial = createInitialDrawWizardState();
      const next = drawWizardReducer(initial, {
        type: "RESTORE_DRAFT",
        step: "amount",
        line: mockLine,
        amount: 2500,
        notice: "Draft restored",
      });
      expect(next.step).toBe("amount");
      expect(next.selectedCreditLine).toEqual(mockLine);
      expect(next.amount).toBe(2500);
      expect(next.draftNotice).toBe("Draft restored");
    });

    it("SET_DRAFT_NOTICE and CLEAR_DRAFT_NOTICE update notice message", () => {
      const initial = createInitialDrawWizardState();
      const withNotice = drawWizardReducer(initial, {
        type: "SET_DRAFT_NOTICE",
        notice: "Wallet changed",
      });
      expect(withNotice.draftNotice).toBe("Wallet changed");

      const cleared = drawWizardReducer(withNotice, {
        type: "CLEAR_DRAFT_NOTICE",
      });
      expect(cleared.draftNotice).toBe("");
    });
  });

  describe("Error and alert messages", () => {
    it("sets and clears submit error", () => {
      const state = createInitialDrawWizardState({ step: "confirm" });
      const withError = drawWizardReducer(state, {
        type: "SET_SUBMIT_ERROR",
        error: "Draw exceeds limit",
      });
      expect(withError.submitError).toBe("Draw exceeds limit");

      const cleared = drawWizardReducer(withError, {
        type: "CLEAR_SUBMIT_ERROR",
      });
      expect(cleared.submitError).toBeNull();
    });

    it("sets eligibility alert", () => {
      const state = createInitialDrawWizardState({ step: "confirm" });
      const withAlert = drawWizardReducer(state, {
        type: "SET_ELIGIBILITY_ALERT",
        reason: "frozen",
      });
      expect(withAlert.eligibilityAlert).toBe("frozen");
    });
  });
});
