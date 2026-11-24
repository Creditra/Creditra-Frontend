import { useEffect } from "react";
import { Link } from "react-router-dom";
import { TERMS_VERSION } from "../constants/legal";

/**
 * Terms of Service page.
 *
 * Displays the current terms with the version number users must accept.
 * When updated, the version is incremented and TermsBanner prompts
 * re-acceptance.
 *
 * @note Placeholder copy below; replace with counsel-approved text.
 */
export function Terms() {
  useEffect(() => {
    document.title = "Terms of Service - Creditra";
  }, []);

  return (
    <main className="terms-page">
      <div className="terms-container">
        <div className="terms-header">
          <h1>Terms of Service</h1>
          <p className="terms-effective-date">
            Effective Date: July 2026
            <span className="terms-version"> (Version {TERMS_VERSION})</span>
          </p>
        </div>

        <div className="terms-content">
          <section>
            <h2>1. Collateral Requirements</h2>
            <p>
              Collateral substitution is permitted for assets with high liquidity.
              A minimum safety buffer of 5% is required and will be monitored in
              real-time.
            </p>
          </section>

          <section>
            <h2>2. Repayment Policies</h2>
            <p>
              Standard automated repayments are processed on the 1st of each month.
              A late repayment grace period of 2 days is allowed, after which a 2%
              penalty is applied.
            </p>
          </section>

          <section>
            <h2>3. FICO Score Nudges</h2>
            <p>
              To assist with financial health, users with FICO scores below 650
              will receive automated hints, tips, and repayment nudges inside their
              dashboard.
            </p>
          </section>

          <section>
            <h2>4. Connected Accounts & Sessions</h2>
            <p>
              All linked external accounts must maintain valid OAuth 2.0 sessions.
              To safeguard user funds, inactive wallet sessions will trigger
              warnings after 60 seconds and auto-disconnect.
            </p>
          </section>

          <section>
            <h2>5. User Responsibilities</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their
              account credentials and for all activities that occur under their
              account. Users agree to provide accurate information and maintain
              current contact details.
            </p>
          </section>

          <section>
            <h2>6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Creditra shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages arising from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h2>7. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws
              of the jurisdiction in which Creditra is incorporated, without regard
              to its conflict of law principles.
            </p>
          </section>
        </div>

        <div className="terms-footer">
          <p className="terms-notice">
            <strong>Note:</strong> This is placeholder legal copy intended for review.
            It will be replaced with counsel-approved text before production deployment.
          </p>
          <nav className="terms-nav">
            <Link to="/privacy" className="terms-link">
              View Privacy Policy
            </Link>
          </nav>
        </div>
      </div>

      <style>{`
        .terms-page {
          min-height: 100vh;
          padding: 2rem;
          background-color: var(--bg-secondary, #0d1117);
          color: var(--text-primary, #c9d1d9);
        }

        .terms-container {
          max-width: 800px;
          margin: 0 auto;
          background-color: var(--bg-primary, #161b22);
          border-radius: 8px;
          padding: 3rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .terms-header {
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border-color, #30363d);
          padding-bottom: 2rem;
        }

        .terms-header h1 {
          font-size: 2rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .terms-effective-date {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #8b949e);
        }

        .terms-version {
          font-weight: 600;
          color: var(--text-primary, #c9d1d9);
        }

        .terms-content {
          margin: 2rem 0;
        }

        .terms-content section {
          margin-bottom: 1.5rem;
        }

        .terms-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.5rem 0 0.5rem 0;
        }

        .terms-content p {
          margin: 0.5rem 0;
          line-height: 1.6;
          font-size: 0.95rem;
        }

        .terms-footer {
          border-top: 1px solid var(--border-color, #30363d);
          padding-top: 2rem;
          margin-top: 2rem;
        }

        .terms-notice {
          background-color: var(--bg-secondary, #0d1117);
          border-left: 4px solid var(--warning-color, #d29922);
          padding: 1rem;
          margin: 0 0 1.5rem 0;
          border-radius: 4px;
          font-size: 0.875rem;
          color: var(--text-secondary, #8b949e);
        }

        .terms-nav {
          display: flex;
          gap: 1rem;
        }

        .terms-link {
          color: #58a6ff;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .terms-link:hover {
          color: #79c0ff;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .terms-container {
            padding: 1.5rem;
          }

          .terms-header h1 {
            font-size: 1.5rem;
          }

          .terms-content h2 {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </main>
  );
}
