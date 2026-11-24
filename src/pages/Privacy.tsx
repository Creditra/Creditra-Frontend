import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Privacy Policy page.
 *
 * Displays the privacy policy for Creditra. This page is accessible
 * to all users, logged in or out.
 *
 * @note Placeholder copy below; replace with counsel-approved text.
 */
export function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy - Creditra";
  }, []);

  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <div className="privacy-header">
          <h1>Privacy Policy</h1>
          <p className="privacy-effective-date">Effective Date: July 2026</p>
        </div>

        <div className="privacy-content">
          <section>
            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly, including email, password,
              wallet address, and financial information necessary to process credit
              transactions. We also collect usage data through cookies and analytics
              tools.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve our services, process
              transactions, send communications, comply with legal obligations, and
              protect against fraud. Your data is used to personalize your experience
              and may inform credit decisions.
            </p>
          </section>

          <section>
            <h2>3. Data Security</h2>
            <p>
              We implement industry-standard encryption and security measures to
              protect your personal information. All data transmissions use HTTPS,
              and sensitive data is encrypted at rest. However, no security system
              is completely impervious to attack.
            </p>
          </section>

          <section>
            <h2>4. Sharing Your Information</h2>
            <p>
              We do not sell your personal information. We may share your information
              with service providers, legal authorities when required, and with third
              parties with your explicit consent. All service providers are bound by
              confidentiality agreements.
            </p>
          </section>

          <section>
            <h2>5. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to enhance your experience,
              remember preferences, and analyze usage patterns. You can control
              cookie settings through your browser. Disabling cookies may limit
              functionality.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct,
              delete, or port your personal data. To exercise these rights, please
              contact us at privacy@creditra.com with your request and proof of
              identity.
            </p>
          </section>

          <section>
            <h2>7. Children's Privacy</h2>
            <p>
              Our service is not intended for individuals under 18. We do not
              knowingly collect personal information from children. If we become
              aware of such collection, we will take immediate steps to delete the
              information and notify the user.
            </p>
          </section>

          <section>
            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. We will notify you of
              material changes by posting the updated policy and updating the
              effective date. Your continued use constitutes acceptance of the
              revised policy.
            </p>
          </section>

          <section>
            <h2>9. Contact Us</h2>
            <p>
              If you have questions about this privacy policy or our privacy
              practices, please contact us at{" "}
              <a href="mailto:privacy@creditra.com">privacy@creditra.com</a>.
            </p>
          </section>
        </div>

        <div className="privacy-footer">
          <p className="privacy-notice">
            <strong>Note:</strong> This is placeholder legal copy intended for
            review. It will be replaced with counsel-approved text before
            production deployment.
          </p>
          <nav className="privacy-nav">
            <Link to="/terms" className="privacy-link">
              View Terms of Service
            </Link>
          </nav>
        </div>
      </div>

      <style>{`
        .privacy-page {
          min-height: 100vh;
          padding: 2rem;
          background-color: var(--bg-secondary, #0d1117);
          color: var(--text-primary, #c9d1d9);
        }

        .privacy-container {
          max-width: 800px;
          margin: 0 auto;
          background-color: var(--bg-primary, #161b22);
          border-radius: 8px;
          padding: 3rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .privacy-header {
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border-color, #30363d);
          padding-bottom: 2rem;
        }

        .privacy-header h1 {
          font-size: 2rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .privacy-effective-date {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #8b949e);
        }

        .privacy-content {
          margin: 2rem 0;
        }

        .privacy-content section {
          margin-bottom: 1.5rem;
        }

        .privacy-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.5rem 0 0.5rem 0;
        }

        .privacy-content p {
          margin: 0.5rem 0;
          line-height: 1.6;
          font-size: 0.95rem;
        }

        .privacy-content a {
          color: #58a6ff;
          text-decoration: none;
          transition: color 0.2s;
        }

        .privacy-content a:hover {
          color: #79c0ff;
          text-decoration: underline;
        }

        .privacy-footer {
          border-top: 1px solid var(--border-color, #30363d);
          padding-top: 2rem;
          margin-top: 2rem;
        }

        .privacy-notice {
          background-color: var(--bg-secondary, #0d1117);
          border-left: 4px solid var(--warning-color, #d29922);
          padding: 1rem;
          margin: 0 0 1.5rem 0;
          border-radius: 4px;
          font-size: 0.875rem;
          color: var(--text-secondary, #8b949e);
        }

        .privacy-nav {
          display: flex;
          gap: 1rem;
        }

        .privacy-link {
          color: #58a6ff;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .privacy-link:hover {
          color: #79c0ff;
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .privacy-container {
            padding: 1.5rem;
          }

          .privacy-header h1 {
            font-size: 1.5rem;
          }

          .privacy-content h2 {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </main>
  );
}
