import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Link2,
  Coins,
  CheckCircle,
  Clock,
  Lock,
  AlertTriangle,
  BookOpen,
  X,
} from "lucide-react";
import { useKyc } from "../context/KycContext";
import { fetchLinkedAccounts } from "../services/linkedAccounts";
import { useWalletIdentityKey } from "../hooks/useWalletIdentityKey";
import { useCreditLines } from "../hooks/useCreditLines";
import {
  needsRiskEducationNudge,
  RISK_EDUCATION_VERSION,
} from "../state/riskEducation";
import { getPaymentDueState, type PaymentDueKind } from "../lib/payment-due";
import { readJson, writeJson } from "../utils/storage";
import "./NextSteps.css";

interface NextStepsProps {
  totalAvailable: number;
  totalUtilized: number;
}

/**
 * Advance the wallet-scoped dismissal key. Scoped per wallet identity so a
 * different borrower on the same browser still sees their own next steps.
 */
function dismissalStorageKey(owner: string | null): string | null {
  return owner ? `creditra.next_steps_dismissed.${owner}` : null;
}

export function NextSteps({ totalAvailable, totalUtilized }: NextStepsProps) {
  const { overallStatus } = useKyc();
  const owner = useWalletIdentityKey();
  const { lines } = useCreditLines();
  const [hasLinkedAccount, setHasLinkedAccount] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [needsRiskEducation, setNeedsRiskEducation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchLinkedAccounts()
      .then((accounts) => {
        if (isMounted) {
          setHasLinkedAccount(accounts.length > 0);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch linked accounts for NextSteps:", err);
        if (isMounted) {
          setHasLinkedAccount(false);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Restore the per-wallet dismissal flag.
  useEffect(() => {
    const key = dismissalStorageKey(owner);
    setIsDismissed(key ? readJson<boolean>(key, false) : false);
  }, [owner]);

  // Risk education is per-wallet and versioned; recompute when the wallet changes.
  useEffect(() => {
    setNeedsRiskEducation(
      owner ? needsRiskEducationNudge(owner, RISK_EDUCATION_VERSION) : false,
    );
  }, [owner]);

  const handleDismiss = () => {
    const key = dismissalStorageKey(owner);
    if (key) writeJson(key, true);
    setIsDismissed(true);
  };

  // The most severe payment-due state across the borrower's credit lines.
  const paymentDue: PaymentDueKind = useMemo(() => {
    let worst: PaymentDueKind = "none";
    for (const line of lines) {
      const kind = getPaymentDueState(line);
      if (kind === "overdue") return "overdue";
      if (kind === "due_today") {
        worst = "due_today";
      } else if (kind === "upcoming" && worst === "none") {
        worst = "upcoming";
      }
    }
    return worst;
  }, [lines]);

  const hasPaymentStep = paymentDue === "overdue" || paymentDue === "due_today";
  const isPaymentOverdue = paymentDue === "overdue";

  // 1. KYC Step State
  const isKycCompleted = overallStatus === "approved";
  const isKycPending = overallStatus === "under_review";
  const kycStepStatus: "completed" | "pending" | "todo" = isKycCompleted
    ? "completed"
    : isKycPending
    ? "pending"
    : "todo";

  // 2. Link Account Step State
  const isLinkCompleted = hasLinkedAccount === true;
  const isLinkLocked = !isKycCompleted;
  const linkStepStatus: "completed" | "locked" | "todo" = isLinkCompleted
    ? "completed"
    : isLinkLocked
    ? "locked"
    : "todo";

  // 3. Draw Credit Step State
  const isDrawCompleted = totalUtilized > 0;
  const isDrawLocked = !isKycCompleted || !isLinkCompleted;
  const drawStepStatus: "completed" | "locked" | "todo" = isDrawCompleted
    ? "completed"
    : isDrawLocked
    ? "locked"
    : "todo";

  // Step numbers reflect the rendered order, with any overdue/due-today
  // payment step pinned to the front.
  let stepCursor = 0;
  const paymentStepNumber = hasPaymentStep ? ++stepCursor : 0;
  const kycStepNumber = ++stepCursor;
  const linkStepNumber = ++stepCursor;
  const riskStepNumber = needsRiskEducation ? ++stepCursor : 0;
  const drawStepNumber = ++stepCursor;

  const allCompleted =
    isKycCompleted &&
    isLinkCompleted &&
    isDrawCompleted &&
    !hasPaymentStep &&
    !needsRiskEducation;

  // Trigger the KYC drawer opening by simulating a click on the header's KYC button
  const handleTriggerKyc = () => {
    const kycButton = document.querySelector(".kyc-trigger-btn") as HTMLButtonElement;
    if (kycButton) {
      kycButton.click();
    }
  };

  // Dismissed or nothing left to do — the card stays out of the way.
  if (isDismissed || allCompleted) {
    return null;
  }

  // If loading, render a skeleton state
  if (isLoading || hasLinkedAccount === null) {
    return (
      <div className="next-steps-card skeleton-loading" aria-busy="true" aria-label="Loading next steps">
        <div className="next-steps-header-skeleton" />
        <div className="next-steps-grid-skeleton">
          <div className="next-step-item-skeleton" />
          <div className="next-step-item-skeleton" />
          <div className="next-step-item-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <section className="next-steps-card" aria-labelledby="next-steps-title">
      <div className="next-steps-header">
        <div className="next-steps-header-text">
          <h2 id="next-steps-title" className="next-steps-title">
            ⚡ Next Steps
          </h2>
          <p className="next-steps-subtitle">
            Complete these actions to get started with your Creditra credit line.
          </p>
        </div>
        <button
          type="button"
          className="next-steps-dismiss-btn focus-ring"
          aria-label="Dismiss next steps"
          onClick={handleDismiss}
        >
          <X className="next-steps-dismiss-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="next-steps-grid" role="list">
        {/* Payment due step — surfaced first when a payment is overdue or due today */}
        {hasPaymentStep && (
          <div
            className="next-step-item next-step-item--todo"
            role="listitem"
            aria-label={`Step ${paymentStepNumber}: ${
              isPaymentOverdue ? "Payment Overdue" : "Payment Due Today"
            }. Status: Action Required`}
          >
            <div className="next-step-icon-container">
              <AlertTriangle className="step-icon step-icon--todo" />
            </div>
            <div className="next-step-content">
              <h3 className="step-label">
                {isPaymentOverdue ? "Payment Overdue" : "Payment Due Today"}
              </h3>
              <p className="step-description">
                {isPaymentOverdue
                  ? "A scheduled payment is past due. Repay now to avoid further fees."
                  : "A scheduled payment is due today. Repay now to stay current."}
              </p>
              <Link to="/repay" className="step-action-btn">
                Repay Now
              </Link>
            </div>
          </div>
        )}

        {/* Verify KYC */}
        <div
          className={`next-step-item next-step-item--${kycStepStatus}`}
          role="listitem"
          aria-label={`Step ${kycStepNumber}: Verify KYC. Status: ${
            kycStepStatus === "completed"
              ? "Completed"
              : kycStepStatus === "pending"
              ? "Under Review"
              : "Action Required"
          }`}
        >
          <div className="next-step-icon-container">
            {kycStepStatus === "completed" ? (
              <CheckCircle className="step-icon step-icon--completed" />
            ) : kycStepStatus === "pending" ? (
              <Clock className="step-icon step-icon--pending" />
            ) : (
              <Shield className="step-icon step-icon--todo" />
            )}
          </div>
          <div className="next-step-content">
            <h3 className="step-label">Verify KYC</h3>
            <p className="step-description">
              {kycStepStatus === "completed"
                ? "Identity verification approved."
                : kycStepStatus === "pending"
                ? "Verification is under review."
                : "Submit identity details to unlock credit."}
            </p>
            {kycStepStatus === "todo" && (
              <button
                type="button"
                className="step-action-btn"
                onClick={handleTriggerKyc}
              >
                {overallStatus === "rejected" ? "Retry Verification" : "Start Verification"}
              </button>
            )}
            {kycStepStatus === "pending" && (
              <span className="step-status-tag step-status-tag--pending">Under Review</span>
            )}
            {kycStepStatus === "completed" && (
              <span className="step-status-tag step-status-tag--completed">Verified</span>
            )}
          </div>
        </div>

        {/* Link Account */}
        <div
          className={`next-step-item next-step-item--${linkStepStatus}`}
          role="listitem"
          aria-label={`Step ${linkStepNumber}: Link Account. Status: ${
            linkStepStatus === "completed"
              ? "Completed"
              : linkStepStatus === "locked"
              ? "Locked (Requires KYC)"
              : "Action Required"
          }`}
        >
          <div className="next-step-icon-container">
            {linkStepStatus === "completed" ? (
              <CheckCircle className="step-icon step-icon--completed" />
            ) : linkStepStatus === "locked" ? (
              <Lock className="step-icon step-icon--locked" />
            ) : (
              <Link2 className="step-icon step-icon--todo" />
            )}
          </div>
          <div className="next-step-content">
            <h3 className="step-label">Link Account</h3>
            <p className="step-description">
              {linkStepStatus === "completed"
                ? "External account connected."
                : "Connect external accounts to back your credit."}
            </p>
            {linkStepStatus === "todo" && (
              <Link to="/linked-accounts" className="step-action-btn">
                Connect Account
              </Link>
            )}
            {linkStepStatus === "locked" && (
              <span className="step-status-tag step-status-tag--locked">
                <Lock size={12} style={{ marginRight: 4 }} /> Locked
              </span>
            )}
            {linkStepStatus === "completed" && (
              <span className="step-status-tag step-status-tag--completed">Connected</span>
            )}
          </div>
        </div>

        {/* Risk education nudge — links to the existing /draw-credit?learn=1 entry point */}
        {needsRiskEducation && (
          <div
            className="next-step-item next-step-item--todo"
            role="listitem"
            aria-label={`Step ${riskStepNumber}: Review Risk Education. Status: Action Required`}
          >
            <div className="next-step-icon-container">
              <BookOpen className="step-icon step-icon--todo" />
            </div>
            <div className="next-step-content">
              <h3 className="step-label">Review Risk Education</h3>
              <p className="step-description">
                Learn what a default is and how to avoid one before you borrow.
              </p>
              <Link to="/draw-credit?learn=1" className="step-action-btn">
                Learn More
              </Link>
            </div>
          </div>
        )}

        {/* Draw Credit */}
        <div
          className={`next-step-item next-step-item--${drawStepStatus}`}
          role="listitem"
          aria-label={`Step ${drawStepNumber}: Draw Credit. Status: ${
            drawStepStatus === "completed"
              ? "Completed"
              : drawStepStatus === "locked"
              ? "Locked (Requires KYC & Linked Account)"
              : "Action Required"
          }`}
        >
          <div className="next-step-icon-container">
            {drawStepStatus === "completed" ? (
              <CheckCircle className="step-icon step-icon--completed" />
            ) : drawStepStatus === "locked" ? (
              <Lock className="step-icon step-icon--locked" />
            ) : (
              <Coins className="step-icon step-icon--todo" />
            )}
          </div>
          <div className="next-step-content">
            <h3 className="step-label">Draw Credit</h3>
            <p className="step-description">
              {drawStepStatus === "completed"
                ? "Initial credit draw completed."
                : "Draw funds from your active credit line."}
            </p>
            {drawStepStatus === "todo" && totalAvailable > 0 && (
              <Link to="/draw-credit" className="step-action-btn">
                Draw Funds
              </Link>
            )}
            {drawStepStatus === "todo" && totalAvailable === 0 && (
              <span className="step-status-tag step-status-tag--info">No available credit</span>
            )}
            {drawStepStatus === "locked" && (
              <span className="step-status-tag step-status-tag--locked">
                <Lock size={12} style={{ marginRight: 4 }} /> Locked
              </span>
            )}
            {drawStepStatus === "completed" && (
              <span className="step-status-tag step-status-tag--completed">Completed</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
