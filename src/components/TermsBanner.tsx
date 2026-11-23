import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';
import { TERMS_VERSION } from '../constants/legal';
import './TermsBanner.css';

export function TermsBanner() {
  const [showBanner, setShowBanner] = useState(false);

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
  };

  const handleDismiss = () => {
    sessionStorage.setItem("creditra_terms_dismissed", "true");
    setShowBanner(false);
  };

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
            <Link
              to="/terms"
              className="tb-btn tb-btn--review focus-ring"
              data-testid="tb-review-link"
            >
              Review Terms
            </Link>
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
    </>
  );
}
