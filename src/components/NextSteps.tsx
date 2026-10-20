import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Link2, Coins, CheckCircle, Clock, Lock } from "lucide-react";
import { useKyc } from "../context/KycContext";
import { fetchLinkedAccounts } from "../services/linkedAccounts";
import "./NextSteps.css";

interface NextStepsProps {
  totalAvailable: number;
  totalUtilized: number;
}

export function NextSteps({ totalAvailable, totalUtilized }: NextStepsProps) {
  const { overallStatus } = useKyc();
  const [hasLinkedAccount, setHasLinkedAccount] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Trigger the KYC drawer opening by simulating a click on the header's KYC button
  const handleTriggerKyc = () => {
    const kycButton = document.querySelector(".kyc-trigger-btn") as HTMLButtonElement;
    if (kycButton) {
      kycButton.click();
    }
  };

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

  // If all steps are completed, we can show a success banner or hide it.
  // The requirements say "Surface next actions ... based on state". Showing a "fully completed" state is great for UX.
  const allCompleted = isKycCompleted && isLinkCompleted && isDrawCompleted;

  return (
    <section
      className={`next-steps-card ${allCompleted ? "next-steps-card--all-completed" : ""}`}
      aria-labelledby="next-steps-title"
    >
      <div className="next-steps-header">
        <h2 id="next-steps-title" className="next-steps-title">
          {allCompleted ? "🎉 You're All Set!" : "⚡ Next Steps"}
        </h2>
        <p className="next-steps-subtitle">
          {allCompleted
            ? "You have completed all onboarding steps and drawn credit successfully."
            : "Complete these actions to get started with your Creditra credit line."}
        </p>
      </div>

      <div className="next-steps-grid" role="list">
        {/* Step 1: Verify KYC */}
        <div
          className={`next-step-item next-step-item--${kycStepStatus}`}
          role="listitem"
          aria-label={`Step 1: Verify KYC. Status: ${
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

        {/* Step 2: Link Account */}
        <div
          className={`next-step-item next-step-item--${linkStepStatus}`}
          role="listitem"
          aria-label={`Step 2: Link Account. Status: ${
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

        {/* Step 3: Draw Credit */}
        <div
          className={`next-step-item next-step-item--${drawStepStatus}`}
          role="listitem"
          aria-label={`Step 3: Draw Credit. Status: ${
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
