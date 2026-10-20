import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import './TermsBanner.css';

const TERMS_VERSION = "2026-07";

export function TermsBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const isAccepted = localStorage.getItem("creditra_terms_accepted_version") === TERMS_VERSION;
    const isDismissed = sessionStorage.getItem("creditra_terms_dismissed") === "true";
    if (!isAccepted && !isDismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("creditra_terms_accepted_version", TERMS_VERSION);
    setShowBanner(false);
    setShowModal(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("creditra_terms_dismissed", "true");
    setShowBanner(false);
  };

  const handleOpenReview = () => {
    setShowModal(true);
  };

  const handleCloseReview = () => {
    setShowModal(false);
  };

  // Close modal on Escape key press
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  if (!showBanner) return null;

  return (
    <>
      <div 
        className="terms-banner" 
        role="status" 
        aria-live="polite"
        data-testid="terms-banner"
      >
        <div className="tb-container">
          <span className="tb-icon" aria-hidden="true">
            <Info size={16} strokeWidth={2.5} />
          </span>
          <span className="tb-message">
            We've updated our Terms of Service for the <strong>GrantFox FWC26</strong> campaign. Please review and accept them to continue.
          </span>
          <div className="tb-actions">
            <button
              type="button"
              className="tb-btn tb-btn--review focus-ring"
              onClick={handleOpenReview}
              data-testid="tb-review-btn"
            >
              Review Terms
            </button>
            <button
              type="button"
              className="tb-btn tb-btn--accept focus-ring"
              onClick={handleAccept}
              data-testid="tb-accept-btn"
            >
              Accept
            </button>
          </div>
          <button
            type="button"
            className="tb-close focus-ring"
            onClick={handleDismiss}
            aria-label="Dismiss terms update alert"
            data-testid="tb-dismiss-btn"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showModal && (
        <div 
          className="tb-modal-overlay" 
          onClick={handleCloseReview}
          data-testid="tb-modal-overlay"
        >
          <div 
            className="tb-modal" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="tb-modal-title"
            onClick={(e) => e.stopPropagation()}
            data-testid="tb-modal"
          >
            <div className="tb-modal-header">
              <h2 id="tb-modal-title" className="tb-modal-title">Terms & Conditions Update</h2>
              <button
                type="button"
                className="tb-modal-close focus-ring"
                onClick={handleCloseReview}
                aria-label="Close review dialog"
                data-testid="tb-modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>
            <div className="tb-modal-body">
              <p className="tb-modal-intro">
                Please read the updated Terms of Service for the <strong>GrantFox FWC26 (Stellar Wave)</strong> campaign below.
              </p>
              <div className="tb-modal-content">
                <h3>1. Collateral Requirements</h3>
                <p>
                  Collateral substitution is permitted for assets with high liquidity. A minimum safety buffer of 5% is required and will be monitored in real-time.
                </p>
                
                <h3>2. Repayment Policies</h3>
                <p>
                  Standard automated repayments are processed on the 1st of each month. A late repayment grace period of 2 days is allowed, after which a 2% penalty is applied.
                </p>
                
                <h3>3. FICO Score Nudges</h3>
                <p>
                  To assist with financial health, users with FICO scores below 650 will receive automated hints, tips, and repayment nudges inside their dashboard.
                </p>
                
                <h3>4. Connected Accounts & Sessions</h3>
                <p>
                  All linked external accounts must maintain valid OAuth 2.0 sessions. To safeguard user funds, inactive wallet sessions will trigger warning warnings after 60 seconds and auto-disconnect.
                </p>
              </div>
            </div>
            <div className="tb-modal-footer">
              <button
                type="button"
                className="tb-btn tb-btn--cancel focus-ring"
                onClick={handleCloseReview}
                data-testid="tb-modal-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="tb-btn tb-btn--accept focus-ring"
                onClick={handleAccept}
                data-testid="tb-modal-accept-btn"
              >
                Accept and Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
