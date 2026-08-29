"use client";

/**
 * DrawCreditPage
 *
 * Multi-step draw-credit flow:
 *   1. "select"  – choose a credit line
 *   2. "amount"  – enter draw amount (+ live preview)
 *   3. "confirm" – review details and accept terms
 *   4. "status"  – loading spinner → transaction result
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

import { useRef, useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/Skeleton";
import { useLocation, useNavigate } from "react-router-dom";
import { useReducedMotion } from "@/context/ReducedMotionContext";
import { loadDraft, saveDraft, clearDraft } from "@/state/wizardDraft";
import { CreditLineSelector } from "@/components/CreditLineSelector";
import { AmountInput } from "@/components/AmountInput";
import { PreviewSection } from "@/components/PreviewSection";
import { ConfirmationStep } from "@/components/ConfirmationStep";
import { TransactionStatus } from "@/components/TransactionStatus";
import { InlineHelpOverlay } from "@/components/InlineHelpOverlay";
import { KbdHint } from "@/components/KbdHint";
import { LiveRegion } from "@/components/LiveRegion";
import { CreditLine, DrawStep, Transaction } from "@/types/draw-credit.types";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";
import { normalizeCreditLineAvailability } from "@/lib/credit-line-availability";
import { getDrawAmountValidation } from "@/utils/amountValidation";
import { offlineMutation } from "@/utils/offline";
import { useOnline } from "@/hooks/useOnline";
import { WhyApr } from "@/components/WhyApr";
import { DrawSummaryBar } from "@/components/DrawSummaryBar";
import { useDrawWizardMicroProgress } from "@/hooks/useDrawWizardMicroProgress";
import "@/components/DrawWizardMicroProgress.css";
import "@/styles/focus.css";
import "./DrawCreditPage.css";

const drawSteps = [
  { id: "select", label: "Select line" },
  { id: "amount", label: "Enter amount" },
  { id: "preview", label: "Preview" },
  { id: "confirm", label: "Confirm" },
] as const;

type ProgressStep = (typeof drawSteps)[number]["id"];

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
  const location = useLocation();
  const { queueAction } = useOnline();
  const routeTransaction = location.state?.transaction as Transaction | undefined;
  const draftState = routeTransaction ? null : loadDraft();

  const [step, setStep] = useState<DrawStep>(
    routeTransaction ? "status" : draftState?.step ?? "select",
  );
  const [selectedCreditLine, setSelectedCreditLine] =
    useState<CreditLine | null>(
      draftState?.selectedCreditLine
        ? normalizeCreditLineAvailability(draftState.selectedCreditLine)
        : null,
    );
  const [amount, setAmount] = useState(draftState?.amount ?? 0);

  useEffect(() => {
    if (step === "status") {
      clearDraft();
    } else {
      saveDraft({ step, selectedCreditLine, amount });
    }
  }, [step, selectedCreditLine, amount]);

  const [isLoading, setIsLoading] = useState(false);
  /**
   * Concurrent submission guard (issue #932). The ref is flipped to `true`
   * synchronously inside `handleConfirm`, so a duplicate activation — a
   * double-click on the Confirm button, or a repeated ArrowRight key-down that
   * lands before React re-renders the status step — is rejected
   * deterministically instead of issuing a second draw.
   */
  const isSubmittingRef = useRef(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const [isWhyAprOpen, setIsWhyAprOpen] = useState(false);
  const whyAprTriggerRef = useRef<HTMLButtonElement>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(
    routeTransaction ?? null,
  );
  const [confirmationAcknowledged, setConfirmationAcknowledged] =
    useState(false);

  const { debouncedAnnouncement: microProgressAnnouncement } =
    useDrawWizardMicroProgress({
      selectedCreditLine,
      amount,
      confirmationAcknowledged,
      isOnConfirmStep: step === "confirm",
    });

  const { isReducedMotionActive } = useReducedMotion();

  const handleSelectCreditLine = (creditLine: CreditLine) => {
    // Derive draw availability from the authoritative utilization at the
    // wizard boundary (issue #931) so stale or inconsistent `available`
    // values can never leak into the amount step.
    setSelectedCreditLine(normalizeCreditLineAvailability(creditLine));
    setAmount(0);
    setConfirmationAcknowledged(false);
    setStep("amount");
  };

  const handleAmountNext = (selectedAmount: number) => {
    setAmount(selectedAmount);
    setStep("confirm");
  };

  const [isOfflineBlocked, setIsOfflineBlocked] = useState(false);

  const handleConfirm = async () => {
    const line = selectedCreditLine;

    // Reject any activation while a submission is already in flight, even one
    // that reaches this handler before React flushes the pending state.
    if (isSubmittingRef.current) return;

    // State-transition invariant: only the confirm step may submit, and it
    // requires a credit line and a positive amount.
    if (step !== "confirm" || !line || amount <= 0) return;

    // Submit-time validation (defense in depth). The amount step guards user
    // input, but re-validating here ensures an out-of-bounds amount restored
    // from a wizard draft can never be silently submitted.
    const validation = getDrawAmountValidation(String(amount), line);
    if (!validation.isValid) return;

    isSubmittingRef.current = true;
    setIsLoading(true);
    setStep("status");
    setIsOfflineBlocked(false);

    // Guard the mutation: when offline, never fabricate a success. The
    // draw is queued for retry on reconnect and a clear error surfaces.
    try {
      await offlineMutation({
        fn: async () => {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const succeeded = Math.random() > 0.2;
          const newTransaction: Transaction = {
            id: `TXN-${Date.now()}`,
            creditLineId: line.id,
            amount,
            status: succeeded ? "success" : "error",
            message: succeeded ? undefined : "Insufficient funds available",
            timestamp: new Date(),
          };

          setTransaction(newTransaction);
          setIsLoading(false);
          setStep("status");

          if (newTransaction.status === "success") {
            navigate("/draw-credit/success", {
              replace: true,
              state: { transaction: newTransaction },
            });
          }
        },
        onOffline: () => {
          queueAction(() => {
            void handleConfirm();
          }, 'draw-confirm');
        },
        offlineMessage:
          "You are offline, so your draw cannot be processed yet. It has been queued and will be submitted when your connection is restored.",
      });
    } catch {
      setIsLoading(false);
      setIsOfflineBlocked(true);
    }
    // Always release the lock (success, offline-block, or throw) so a later
    // draw attempt — e.g. after reconnecting and flushing the queue, a failed
    // submission, or "Make Another Draw" — is never blocked by a stale flag.
    // Note: dedup via the 'draw-confirm' key still prevents double-submission
    // when the user re-triggers while offline.
    isSubmittingRef.current = false;
  };

  const handleNewDraw = () => {
    navigate("/draw-credit", { replace: true });
    setStep("select");
    setSelectedCreditLine(null);
    setAmount(0);
    setConfirmationAcknowledged(false);
    setTransaction(null);
  };

  const handleBack = useCallback(() => {
    if (step === "amount") {
      setStep("select");
      setSelectedCreditLine(null);
      setConfirmationAcknowledged(false);
    } else if (step === "confirm") {
      setStep("amount");
      setConfirmationAcknowledged(false);
    }
  }, [step]);

  const handleCancel = useCallback(() => {
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFocusedOnInput()) return;

      switch (e.key) {
        case "Escape":
          if (step === "select") {
            e.preventDefault();
            handleCancel();
          } else if (step === "amount" || step === "confirm") {
            e.preventDefault();
            handleBack();
          }
          break;

        case "ArrowLeft":
          if (step === "amount" || step === "confirm") {
            e.preventDefault();
            handleBack();
          }
          break;

        case "ArrowRight":
          if (step === "amount" && amount > 0) {
            e.preventDefault();
            handleAmountNext(amount);
          }
          if (step === "confirm" && confirmationAcknowledged) {
            e.preventDefault();
            void handleConfirm();
          }
          break;

        case "?":
          e.preventDefault();
          setIsHelpOpen(true);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, amount, confirmationAcknowledged, handleBack, handleCancel]);

  return (
    <main className="dc-page" aria-label="Draw credit">
      <LiveRegion
        id="draw-wizard-progress-announcement"
        message={microProgressAnnouncement}
      />
      <div className="dc-page__inner">
        <div className="dc-page__card">
          {step === "select" && (
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

          {step === "amount" && selectedCreditLine && (
            <div className="dc-step">
              <AmountInput
                creditLine={selectedCreditLine}
                onAmountChange={setAmount}
                onNext={handleAmountNext}
                onBack={handleBack}
              />
              <div className="dc-separator">
                <PreviewSection
                  creditLine={selectedCreditLine}
                  amount={amount}
                />
              </div>
              <div className="dc-kbd-bar" aria-label="Keyboard shortcuts">
                <KbdHint
                  keys={["←", "→"]}
                  label="Back / Continue"
                  separator="/"
                  description="Use left and right arrow keys to go back or continue"
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

          {step === "confirm" && selectedCreditLine && (
            <>
              <ConfirmationStep
                creditLine={selectedCreditLine}
                amount={amount}
                onConfirm={handleConfirm}
                onBack={handleBack}
                onCancel={handleCancel}
                isLoading={isLoading}
                agreedToTerms={confirmationAcknowledged}
                onAgreedToTermsChange={setConfirmationAcknowledged}
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

          {step === "status" && (isLoading || transaction || isOfflineBlocked) && (
            <>
              {isLoading && (
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
                  </div>
                </div>
              )}
              {isOfflineBlocked && !isLoading && (
                <div
                  className="dc-step"
                  role="alert"
                  aria-live="assertive"
                >
                  <h2 className="dc-step__title">You're offline</h2>
                  <p className="dc-step__subtitle">
                    Your draw cannot be processed while offline. It has been
                    queued and will be submitted automatically when your
                    connection is restored.
                  </p>
                  <button
                    type="button"
                    className="focus-ring dc-step__back-btn"
                    onClick={() => {
                      setIsOfflineBlocked(false);
                      setStep("confirm");
                    }}
                  >
                    Back to review
                  </button>
                </div>
              )}
              {transaction && !isLoading && (
                <TransactionStatus
                  transaction={transaction}
                  onNewDraw={handleNewDraw}
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
        creditLine={selectedCreditLine}
        amount={amount}
        step={step}
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
                        <Skeleton width="120px" height="24px" className="mb-3" />
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
