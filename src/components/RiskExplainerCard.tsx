import { useState, useEffect } from 'react';

export function RiskExplainerCard() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('risk-explainer-dismissed') === 'true') {
        setDismissed(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('risk-explainer-dismissed', 'true');
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <section
      className="risk-explainer-card"
      aria-label="How risk pricing works"
      role="region"
    >
      <div className="risk-explainer-content">
        <div className="risk-explainer-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
            <path d="M24 14v12l8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="risk-explainer-text">
          <h3>How risk pricing works</h3>
          <p>
            Creditra evaluates your on-chain repayment history, collateral volatility,
            and market conditions to determine your personalized APR. Better repayment
            history means lower rates.
          </p>
          <a href="/docs#risk-pricing" className="risk-explainer-link" aria-label="Learn more about risk pricing">
            Learn more
          </a>
        </div>
      </div>
      <button className="risk-explainer-dismiss" onClick={handleDismiss} aria-label="Dismiss risk pricing explainer">
        Dismiss
      </button>
    </section>
  );
}
