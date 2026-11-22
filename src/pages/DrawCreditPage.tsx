"use client";

/**
 * DrawCreditPage
 *
 * Multi-step draw-credit flow:
 *   1. "select"  - choose a credit line
 *   2. "amount"  - enter draw amount (+ live preview)
 *   3. "confirm" - review details and accept terms
 *   4. "status"  - loading spinner -> transaction result
 *
 * Spacing, colour and typography all reference design tokens via the
 * `dc-*` CSS classes defined in `src/index.css`. No raw Tailwind colour
 * utilities (blue-500, green-400, etc.) are used in this module.
 *
 * Accessibility:
 *   - <main> labelled with aria-label for screen-reader landmark navigation
 *   - Loading state wrapped in role="status" + aria-live="polite"
 *   - Spinner has aria-label describing the in-progress action
 *   - Keyboard-only focus rings via `src/styles/focus.css` (FWC26 / issue #592)
 *
 * Reduced-motion strategy (GrantFox FWC26 / issue #693):
 *   - DrawCreditPage.css suppresses all animations and transitions on
 *     `.dc-page` descendants via @media (prefers-reduced-motion: reduce)
 *     and the in-app [data-motion="reduced"] attribute override.
 *   - The animated `dc-spinner-ring` is replaced with a static SVG icon
 *     (dc-spinner-static) when `isReducedMotionActive` is true, giving
 *     a meaningful visual fallback rather than a frozen rotation frame.
 */

import { useRef, useState, useReducer, useEffect, useCallback, useContext } from "react";
import { Skeleton } from "@/components/Skeleton";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useReducedMotion } from "@/context/ReducedMotionContext";
import {
  loadDraft,
  saveDraft,
  clearDraft,
} from "@/state/wizardDraft";
import { useDraftSaveStatus } from "@/hooks/useDraftSaveStatus";
import { DraftSavedIndicator } from "@/components/DraftSavedIndicator";
import {
  drawWizardReducer,
  createInitialDrawWizardState,
  type DrawWizardState,
} from "@/state/drawWizardMachine";
import { useWallet, walletIdentityKey } from "@/context/WalletContext";
import { getStoredWallet, isWalletRemembered } from "@/utils/wallet";
import { readJson, writeJson } from "@/utils/storage";
import {
  DEFAULT_RISK_ACK_KEY,
  DEFAULT_RISK_BANNER_DISMISSED_KEY,
  GRANTFOX_RISK_EDUCATION_ACK_KEY,
} from "@/constants/storageKeys";
import { DefaultRiskModal } from "@/components/DefaultRiskModal";
import { CreditLineSelector } from "@/components/CreditLineSelector";
import { AmountInput } from "@/components/AmountInput";
import { DrawingLimit } from "@/components/DrawingLimit";
import { PreviewSection } from "@/components/PreviewSection";
import { ConfirmationStep } from "@/components/ConfirmationStep";
import { TransactionStatus } from "@/components/TransactionStatus";
import { InlineHelpOverlay } from "@/components/InlineHelpOverlay";
import { KbdHint } from "@/components/KbdHint";
import { LiveRegion } from "@/components/LiveRegion";
import { CreditLine, Transaction } from "@/types/draw-credit.types";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";
import { normalizeCreditLineAvailability } from "@/lib/credit-line-availability";
import {
  DRAW_INELIGIBILITY_REASON_LABELS,
  getDrawEligibility,
} from "@/lib/draw-eligibility";
import { classifyDrawError } from "@/lib/draw-errors";
import { getDrawAmountValidation } from "@/utils/amountValidation";
import { getDrawPricingQuote } from "@/lib/draw-credit-pricing";
import { projectDraw } from "@/lib/draw-projection";
import { offlineMutation } from "@/utils/offline";
import { NotificationContext } from "@/context/NotificationContext";
import { useOnline } from "@/hooks/useOnline";
import { WhyApr } from "@/components/WhyApr";
import { DrawSummaryBar } from "@/components/DrawSummaryBar";
import { useDrawWizardMicroProgress } from "@/hooks/useDrawWizardMicroProgress";
import "@/components/DrawWizardMicroProgress.css";
import "@/styles/focus.css";
import "./DrawCreditPage.css";

/** Returns true if the currently focused element can receive text input. */
function isFocusedOnInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as HTMLElement).isContentEditable;
}

export default function DrawCreditPage() {
  const navigate = useNavigate();
  // Read the context directly (not `useNotifications()`) so this
  // component renders in isolation tests without a provider.
  // In production, App.tsx always wraps this in <NotificationProvider>,
  // so `addToast` is defined and the toast fires.
  const notifCtx = useContext(NotificationContext);
  const addToast = notifCtx?.addToast;
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLearnMode = searchParams.get("learn") === "1";

  // The default-risk education is offered, never forced: first-time borrowers
  // see a dismissible inline banner (remembered in localStorage) and can open
  // the 3-step modal from it. `?learn=1` still opens the modal directly.
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(
    () =>
      readJson<boolean>(DEFAULT_RISK_ACK_KEY, false) ||
      readJson<boolean>(GRANTFOX_RISK_EDUCATION_ACK_KEY, false) ||
      readJson<boolean>(DEFAULT_RISK_BANNER_DISMISSED_KEY, false),
  );
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(() => isLearnMode);
  const riskBannerTriggerRef = useRef<HTMLButtonElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isLearnMode) {
      setIsRiskModalOpen(true);
    }
  }, [isLearnMode]);

  const closeRiskModal = useCallback(() => {
    if (isLearnMode) {
      // Strip ?learn=1 from the URL without adding a history entry.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("learn");
      setSearchParams(nextParams, { replace: true });
    }
    setIsRiskModalOpen(false);
  }, [isLearnMode, searchParams, setSearchParams]);

  const handleRiskModalDismiss = useCallback(() => {
    closeRiskModal();
    // The banner stays mounted (hidden) while the modal is open, so the
    // trigger is still connected and can receive focus after the exit
    // animation completes.
    requestAnimationFrame(() => {
      riskBannerTriggerRef.current?.focus();
    });
  }, [closeRiskModal]);

  // Declared before handleRiskModalAcknowledgeAndFocus, whose dependency
  // array reads it during render.
  const handleRiskModalAcknowledge = useCallback(() => {
    writeJson(DEFAULT_RISK_ACK_KEY, true);
    writeJson(GRANTFOX_RISK_EDUCATION_ACK_KEY, true);
    setHasAcknowledgedRisk(true);
    closeRiskModal();
  }, [closeRiskModal]);

  const handleRiskModalAcknowledgeAndFocus = useCallback(() => {
    handleRiskModalAcknowledge();
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  }, [handleRiskModalAcknowledge]);

  const handleDismissRiskBanner = useCallback(() => {
    writeJson(DEFAULT_RISK_BANNER_DISMISSED_KEY, true);
    setHasAcknowledgedRisk(true);
  }, []);

  const { queueAction } = useOnline();
  const { wallet } = useWallet();
  // Auto-reconnect starts after the first render, so fall back to the
  // remembered wallet during that window. Without this, a draft saved by the
  // remembered wallet would look foreign to the initial `null` identity and be
  // discarded before reconnection completes. The owner-change effect still
  // clears it if a different wallet connects.
  const rememberedWallet = isWalletRemembered() ? getStoredWallet() : null;
  const draftOwner = walletIdentityKey(wallet ?? (rememberedWallet as any));
  const routeTransaction = location.state?.transaction as Transaction | undefined;

  // Drafts belong to the wallet identity that created them. Clear the
  // persisted draft when the wallet disconnects or switches accounts, and skip
  // the save effect for the commit that observed the change so the old flow is
  // not immediately re-persisted under the new owner.
  const previousDraftOwner = useRef(draftOwner);
  const skipNextDraftSave = useRef(false);
  const draftSave = useDraftSaveStatus();

  /**
   * Initialize reducer state from route transaction or persisted draft.
   */
  const [state, dispatch] = useReducer(
    drawWizardReducer,
    undefined,
    (): DrawWizardState => {
      if (routeTransaction) {
        return createInitialDrawWizardState({
          step: "status",
          transaction: routeTransaction,
        });
      }

      const draft = loadDraft(draftOwner);
      if (!draft) return createInitialDrawWizardState();

      if (draft.step === "select") {
        return createInitialDrawWizardState();
      }

      const line = mockCreditLines.find(
        (candidate) => candidate.id === draft.lineId,
      );

      if (!line) {
        clearDraft();
        return createInitialDrawWizardState({
          draftNotice:
            "Your saved draw draft was discarded because that credit line is no longer available.",
        });
      }

      const normalizedLine = normalizeCreditLineAvailability(line);
      if (!getDrawEligibility(normalizedLine).eligible) {
        clearDraft();
        skipNextDraftSave.current = true;
        return createInitialDrawWizardState({
          draftNotice:
            "Your saved draw draft was discarded because that credit line is no longer eligible for a draw.",
        });
      }

      return createInitialDrawWizardState({
        step: draft.step === "amount" ? "amount" : "select",
        selectedCreditLine: normalizedLine,
        amount: draft.step === "amount" ? draft.amountCents / 100 : 0,
      });
    },
  );

  useEffect(() => {
    if (previousDraftOwner.current === draftOwner) return;

    previousDraftOwner.current = draftOwner;
    clearDraft();
    draftSave.reset();
    skipNextDraftSave.current = true;
    dispatch({
      type: "SET_DRAFT_NOTICE",
      notice: draftOwner
        ? "Your saved draw draft was cleared because the wallet changed."
        : "Your saved draw draft was cleared because the wallet disconnected.",
    );
  }, [draftOwner, draftSave.reset]);

  useEffect(() => {
    if (state.step === "status") {
      clearDraft();
      draftSave.reset();
      return;
    }

    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    const ok = saveDraft(
      {
        step: state.step === "confirm" ? "amount" : state.step,
        lineId: state.selectedCreditLine?.id ?? null,
        amountCents: Math.round(state.amount * 100),
      },
      draftOwner,
    );
    if (ok) {
      draftSave.markSaved();
    } else {
      draftSave.markError();
    }
  }, [
    step,
    selectedCreditLine,
    amount,
    draftOwner,
    draftSave.markSaved,
    draftSave.markError,
    draftSave.reset,
  ]);

  /**
   * Concurrent submission guard (issue #932). The ref is flipped to `true`
   * synchronously inside `handleConfirm`, so a duplicate activation - a
   * double-click on the Confirm button, or a repeated ArrowRight key-down that
   * lands before React re-renders the status step - is rejected
   * deterministically instead of issuing a second draw.
   */
  const isSubmittingRef = useRef(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const [isWhyAprOpen, setIsWhyAprOpen] = useState(false);
  const whyAprTriggerRef = useRef<HTMLButtonElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const { debouncedAnnouncement: microProgressAnnouncement } =
    useDrawWizardMicroProgress({
      selectedCreditLine: state.selectedCreditLine,
      amount: state.amount,
      confirmationAcknowledged: state.confirmationAcknowledged,
      isOnConfirmStep: state.step === "confirm",
    });

  const { isReducedMotionActive } = useReducedMotion();

  const amountStepValidation = selectedCreditLine
    ? getDrawAmountValidation(String(amount), selectedCreditLine)
    : null;
  const utilizedCredit = selectedCreditLine
    ? Math.max(0, selectedCreditLine.limit - selectedCreditLine.available)
    : 0;

  const handleSelectCreditLine = (creditLine: CreditLine) => {
    // Derive draw availability from the authoritative utilization at the
    // wizard boundary (issue #931) so stale or inconsistent `available`
    // values can never leak into the amount step.
    setSelectedCreditLine(normalizeCreditLineAvailability(creditLine));
    setAmount(0);
    setConfirmationAcknowledged(false);
    setEligibilityAlert(null);
    setStep("amount");
  };

  const handleAmountChange = useCallback((amount: number) => {
    dispatch({ type: "SET_AMOUNT", amount });
  }, []);

  const handleAmountNext = useCallback((selectedAmount: number) => {
    dispatch({ type: "PROCEED_TO_CONFIRM", amount: selectedAmount });
  }, []);

  const handleAgreedToTermsChange = useCallback((acknowledged: boolean) => {
    dispatch({
      type: "SET_CONFIRMATION_ACKNOWLEDGED",
      acknowledged,
    });
  }, []);

  const handleConfirm = async () => {
    const line = state.selectedCreditLine;

    // Reject any activation while a submission is already in flight
    if (isSubmittingRef.current) return;

    // State-transition invariant: only confirm step may submit, and requires line and positive amount
    if (state.step !== "confirm" || !line || state.amount <= 0 || state.isLoading) {
      return;
    }

    // Re-check eligibility against latest line data
    const latestLine =
      mockCreditLines.find((candidate) => candidate.id === line.id) ?? line;
    const latestEligibility = getDrawEligibility(
      normalizeCreditLineAvailability(latestLine),
    );
    if (!latestEligibility.eligible) {
      dispatch({
        type: "SET_ELIGIBILITY_ALERT",
        reason: latestEligibility.reason,
      });
      return;
    }
    dispatch({ type: "SET_ELIGIBILITY_ALERT", reason: null });

    // Submit-time validation
    const validation = getDrawAmountValidation(String(state.amount), line);
    if (!validation.isValid) {
      dispatch({
        type: "SET_SUBMIT_ERROR",
        error: validation.feedback.message,
      });
      return;
    }
    const projection = projectDraw(
      line,
      state.amount,
      getDrawPricingQuote(line, state.amount),
    );
    if (projection.exceedsLimit) {
      dispatch({
        type: "SET_SUBMIT_ERROR",
        error: "This draw exceeds the credit line limit after the 1% fee.",
      });
      return;
    }

    isSubmittingRef.current = true;
    dispatch({ type: "SUBMIT_START" });

    // Guard mutation
    try {
      await offlineMutation({
        fn: async () => {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const succeeded = Math.random() > 0.2;
          const newTransaction: Transaction = {
            id: `TXN-${Date.now()}`,
            creditLineId: line.id,
            amount: state.amount,
            status: succeeded ? "success" : "error",
            message: succeeded ? undefined : "Insufficient funds available",
            timestamp: new Date(),
          };

          if (!isMountedRef.current) {
            addToast?.({
              type: succeeded ? "success" : "error",
              category: "transaction",
              title: succeeded
                ? `Your $${state.amount} draw succeeded`
                : `Your $${state.amount} draw failed`,
              message: succeeded
                ? "View the details in your transaction history."
                : "Insufficient funds available.",
              action: {
                label: "View transactions",
                onClick: () => navigate("/transactions"),
              },
              saveToHistory: true,
            });
            return;
          }

          if (succeeded) {
            dispatch({ type: "SUBMIT_SUCCESS", transaction: newTransaction });
            navigate("/draw-credit/success", {
              replace: true,
              state: { transaction: newTransaction },
            });
          } else {
            dispatch({
              type: "SUBMIT_ERROR",
              transaction: newTransaction,
              errorKind: classifyDrawError(newTransaction),
            });
          }
        },
        onOffline: () => {
          queueAction(() => {
            void handleConfirm();
          }, "draw-confirm");
        },
        offlineMessage:
          "You are offline, so your draw cannot be processed yet. It has been queued and will be submitted when your connection is restored.",
      });
    } catch {
      dispatch({ type: "SUBMIT_OFFLINE_BLOCKED" });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleNewDraw = () => {
    navigate("/draw-credit", { replace: true });
    dispatch({ type: "RESET" });
  };

  const handleRetry = useCallback(() => {
    dispatch({ type: "RETRY" });
  }, []);

  const handleBack = useCallback(() => {
    dispatch({ type: "BACK" });
  }, []);

  const handleCancel = useCallback(() => {
    clearDraft();
    draftSave.reset();
    navigate("/");
  }, [navigate, draftSave.reset]);

  // Issue #1180: warn on tab close while a submission is in flight.
  useEffect(() => {
    if (!state.isLoading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isLoading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isFocusedOnInput()) return;

      const hasOpenDialog =
        isRiskModalOpen ||
        document.querySelector('[role="dialog"][aria-modal="true"]') !== null;

      if (e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        if (!hasOpenDialog) setIsHelpOpen(true);
        return;
      }

      if (hasOpenDialog) return;

      switch (e.key) {
        case "Escape":
          if (state.step === "select") {
            e.preventDefault();
            handleCancel();
          } else if (state.step === "amount" || state.step === "confirm") {
            e.preventDefault();
            handleBack();
          }
          break;

        case "ArrowLeft":
          if (state.step === "amount" || state.step === "confirm") {
            e.preventDefault();
            handleBack();
          }
          break;

        case "ArrowRight":
          if (state.step === "amount" && state.selectedCreditLine) {
            e.preventDefault();
            const validation = getDrawAmountValidation(
              String(state.amount),
              state.selectedCreditLine,
            );
            if (validation.isValid) {
              handleAmountNext(state.amount);
            } else {
              amountInputRef.current?.focus();
              dispatch({
                type: "SET_SUBMIT_ERROR",
                error: validation.message,
              });
            }
          }
          if (state.step === "confirm" && state.confirmationAcknowledged) {
            e.preventDefault();
            void handleConfirm();
          }
          break;

        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [
    state.step,
    state.amount,
    state.selectedCreditLine,
    state.confirmationAcknowledged,
    handleBack,
    handleCancel,
    isRiskModalOpen,
  ]);

  return (
    <main className="dc-page" aria-label="Draw credit">
      <DefaultRiskModal
        isOpen={isRiskModalOpen}
        onAcknowledge={handleRiskModalAcknowledgeAndFocus}
        onDismiss={handleRiskModalDismiss}
        triggerRef={riskBannerTriggerRef}
      />
      <LiveRegion
        id="draw-wizard-progress-announcement"
        message={microProgressAnnouncement}
      />
      {state.submitError && state.step === "amount" && (
        <LiveRegion
          id="draw-wizard-amount-error-announcement"
          message={state.submitError}
        />
      )}
      <div className="dc-page__inner">
        {!hasAcknowledgedRisk && (
          <div className="dc-risk-banner" role="note" hidden={isRiskModalOpen}>
            <p className="dc-risk-banner__text">
              <strong>First draw?</strong> Take a 1-minute primer on what a
              default is and how to avoid one.
            </p>
            <div className="dc-risk-banner__actions">
              <button
                ref={riskBannerTriggerRef}
                type="button"
                className="dc-risk-banner__learn"
                onClick={() => setIsRiskModalOpen(true)}
              >
                Learn about default risk
              </button>
              <button
                type="button"
                className="dc-risk-banner__dismiss"
                onClick={handleDismissRiskBanner}
                aria-label="Dismiss default-risk primer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div className="dc-page__card">
          <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
            Draw credit step
          </h2>
          {state.draftNotice && (
            <p className="dc-draft-notice" role="status">
              {state.draftNotice}
            </p>
          )}
          {state.step === "select" && (
            <>
              <CreditLineSelector
                creditLines={mockCreditLines}
                onSelect={handleSelectCreditLine}
              />
              <div className="dc-kbd-bar" aria-label="Keyboard shortcuts">
                <KbdHint
                  keys="Esc"
                  label="Cancel"
                  description="Press Escape to cancel and go back to the dashboard"
                />
                <KbdHint
                  keys="?"
                  label="Help"
                  description="Press ? to open keyboard shortcut help"
                />
              </div>
            </>
          )}

          {state.step === "amount" && state.selectedCreditLine && (
            <div className="dc-step">
              <DrawingLimit
                className="dc-drawing-limit"
                drawnAmount={
                  utilizedCredit + (amountStepValidation?.amount ?? 0)
                }
                totalLimit={selectedCreditLine.limit}
                drawnLabel="Utilised"
                availableLabel="Available after draw"
                announcePercentage={false}
              />
              <AmountInput
                ref={amountInputRef}
                creditLine={state.selectedCreditLine}
                initialAmount={state.amount}
                onAmountChange={handleAmountChange}
                onNext={handleAmountNext}
                onBack={handleBack}
              />
              <DraftSavedIndicator
                status={draftSave.status}
                savedAt={draftSave.savedAt}
                className="text-right"
              />
              <div className="dc-separator">
                <PreviewSection
                  creditLine={state.selectedCreditLine}
                  amount={state.amount}
                />
              </div>
              <div className="dc-kbd-bar" aria-label="Keyboard shortcuts">
                <KbdHint
                  keys={["←", "→"]}
                  label="Back / Continue"
                  separator="/"
                  description="Use left and right arrow keys to go back or continue; → requires a valid amount"
                />
                <KbdHint
                  keys="Esc"
                  label="Back"
                  description="Press Escape to go back to the previous step"
                />
                <KbdHint
                  keys="?"
                  label="Help"
                  description="Press ? to open keyboard shortcut help"
                />
              </div>
            </div>
          )}

          {state.step === "confirm" && state.selectedCreditLine && (
            <>
              {state.eligibilityAlert && (
                <div
                  className="dc-eligibility-alert"
                  role="alert"
                  aria-live="assertive"
                >
                  <strong>This credit line can no longer be drawn from.</strong>{" "}
                  {DRAW_INELIGIBILITY_REASON_LABELS[state.eligibilityAlert]}. Please
                  choose another line before submitting.
                </div>
              )}
              {state.submitError && (
                <div className="dc-step dc-step--error" role="alert">
                  <p className="dc-step__subtitle">
                    This amount is no longer valid: {state.submitError}
                  </p>
                  <button
                    type="button"
                    className="focus-ring dc-step__back-btn"
                    onClick={() => dispatch({ type: "EDIT_AMOUNT_FROM_ERROR" })}
                  >
                    Change amount
                  </button>
                </div>
              )}
              <ConfirmationStep
                creditLine={state.selectedCreditLine}
                amount={state.amount}
                onConfirm={handleConfirm}
                onBack={handleBack}
                onCancel={handleCancel}
                isLoading={state.isLoading}
                agreedToTerms={state.confirmationAcknowledged}
                onAgreedToTermsChange={handleAgreedToTermsChange}
              />
              <DraftSavedIndicator
                status={draftSave.status}
                savedAt={draftSave.savedAt}
                className="mt-2 text-right"
              />
              <div className="dc-kbd-bar" aria-label="Keyboard shortcuts">
                <KbdHint
                  keys={["←", "→"]}
                  label="Back / Confirm"
                  separator="/"
                  description="Use left arrow to go back; right arrow to confirm when terms are accepted"
                />
                <KbdHint
                  keys="Esc"
                  label="Back"
                  description="Press Escape to go back to the previous step"
                />
                <KbdHint
                  keys="?"
                  label="Help"
                  description="Press ? to open keyboard shortcut help"
                />
              </div>
            </>
          )}

          {state.step === "status" &&
            (state.isLoading || state.transaction || state.isOfflineBlocked) && (
              <>
                {state.isLoading && (
                  <div
                    className="dc-spinner-wrap"
                    role="status"
                    aria-live="polite"
                    aria-label="Processing your draw request"
                  >
                    <div className="dc-spinner-ring-bg">
                      {isReducedMotionActive ? (
                        <div className="dc-spinner-static" aria-hidden="true">
                          <svg
                            viewBox="0 0 64 64"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            width="64"
                            height="64"
                            aria-hidden="true"
                          >
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <line
                              x1="32"
                              y1="32"
                              x2="32"
                              y2="14"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <line
                              x1="32"
                              y1="32"
                              x2="46"
                              y2="32"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="dc-spinner-ring" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <h2 className="dc-step__title">Processing</h2>
                      <p className="dc-step__subtitle">
                        Your draw request is being processed.
                      </p>
                      <p
                        className="dc-step__subtitle"
                        data-testid="draw-status-hint"
                        style={{ marginTop: "0.25rem", fontSize: "0.8125rem" }}
                      >
                        You can leave this page; we&apos;ll notify you when it
                        completes.
                      </p>
                    </div>
                  </div>
                )}
                {state.isOfflineBlocked && !state.isLoading && (
                  <div className="dc-step" role="alert" aria-live="assertive">
                    <h2 className="dc-step__title">You're offline</h2>
                    <p className="dc-step__subtitle">
                      Your draw cannot be processed while offline. It has been
                      queued and will be submitted automatically when your
                      connection is restored.
                    </p>
                    <button
                      type="button"
                      className="focus-ring dc-step__back-btn"
                      onClick={() =>
                        dispatch({ type: "OFFLINE_BACK_TO_REVIEW" })
                      }
                    >
                      Back to review
                    </button>
                  </div>
                )}
                {state.transaction && !state.isLoading && (
                  <TransactionStatus
                    transaction={state.transaction}
                    onNewDraw={handleNewDraw}
                    onRetry={handleRetry}
                    errorKind={state.errorKind}
                  />
                )}
              </>
            )}
        </div>

        <p className="dc-page__footer">
          Need help?{" "}
          <button
            ref={helpTriggerRef}
            type="button"
            className="focus-ring hover:text-foreground transition-colors underline underline-offset-4"
            onClick={() => setIsHelpOpen(true)}
          >
            Contact support
          </button>{" "}
          at 1-800-CREDIT-1
        </p>
      </div>
      <InlineHelpOverlay
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={helpTriggerRef}
      />
      <WhyApr
        isOpen={isWhyAprOpen}
        onClose={() => setIsWhyAprOpen(false)}
        triggerRef={whyAprTriggerRef}
      />
      <DrawSummaryBar
        creditLine={state.selectedCreditLine}
        amount={state.amount}
        step={state.step}
      />
    </main>
  );
}

export function DrawCreditPageSkeleton() {
  return (
    <main
      className="dc-page"
      aria-busy="true"
      aria-label="Loading draw credit page"
    >
      <div className="dc-page__inner">
        <div className="dc-page__card" aria-hidden="true">
          <div className="dc-step">
            <div>
              <Skeleton width="200px" height="32px" className="mb-2" />
              <Skeleton width="300px" height="24px" />
            </div>

            <ul className="dc-credit-line-list" role="list">
              {[1, 2, 3].map((i) => (
                <li key={i}>
                  <div className="dc-credit-line-item">
                    <div className="dc-credit-line-item__inner w-full">
                      <div className="dc-credit-line-item__body w-full">
                        <Skeleton
                          width="120px"
                          height="24px"
                          className="mb-3"
                        />
                        <div className="flex gap-6 mb-3">
                          <div className="space-y-1">
                            <Skeleton width="60px" height="14px" />
                            <Skeleton width="80px" height="20px" />
                          </div>
                          <div className="space-y-1">
                            <Skeleton width="70px" height="14px" />
                            <Skeleton width="50px" height="20px" />
                          </div>
                        </div>
                        <Skeleton width="100%" height="8px" shape="rounded" />
                      </div>
                      <div className="ml-4 flex-shrink-0 flex items-center justify-center">
                        <Skeleton width="20px" height="20px" shape="circular" />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="dc-page__footer flex justify-center mt-4">
          <Skeleton width="250px" height="20px" />
        </div>
      </div>
    </main>
  );
}
