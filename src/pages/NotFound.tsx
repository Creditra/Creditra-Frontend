import { Link } from "react-router-dom";
import "./ErrorPage.css";

export function NotFound() {
  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          🔍
        </div>
        <h1 className="error-title">Page not found</h1>
        <p className="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="error-actions">
          <button
            className="error-btn error-btn-primary"
            onClick={handleGoBack}
            aria-label="Go back to previous page"
          >
            Go Back
          </button>
          <Link
            to="/"
            className="error-btn error-btn-secondary"
            aria-label="Return to dashboard"
          >
            Dashboard
          </Link>
          <a
            href="mailto:support@creditra.com"
            className="error-btn error-btn-secondary"
            aria-label="Contact support via email"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
