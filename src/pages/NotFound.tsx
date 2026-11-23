import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { suggestRoute } from "../utils/suggestRoute";
import "./ErrorPage.css";

/**
 * Route-fallback 404 page.
 *
 * Wired up as the wildcard route in `src/App.tsx`. Renders the same
 * `ErrorPage.css` look as the `ErrorBoundary`'s render-error fallback,
 * so a "page not found" and a "page crashed" share visual treatment and
 * the user learns one recovery pattern.
 *
 * Surfaces two affordances:
 * - "Go back" — calls `window.history.go(-1)` when history is available,
 *   otherwise falls back to a "Go to Dashboard" `Link` to `/`
 * - "Contact Support" — mailto link
 *
 * Both keep keyboard semantics native (button + link).
 */
export function NotFound() {
  const { pathname } = useLocation();
  const suggestion = suggestRoute(pathname);
  // Checked after mount to avoid SSR mismatch on history.length
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <main className="error-page" aria-labelledby="notfound-title">
      <div className="error-content">

        {/* currentColor inherits var(--text), so this works in both themes */}
        <svg
          className="error-illustration"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 200 160"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="100" cy="148" rx="70" ry="8" fill="currentColor" opacity="0.06" />
          <line x1="124" y1="114" x2="148" y2="138" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
          <circle cx="90" cy="82" r="36" fill="none" stroke="currentColor" strokeWidth="7" opacity="0.6" />
          <circle cx="90" cy="82" r="29" fill="currentColor" opacity="0.04" />
          <path d="M 82 72 Q 82 62 90 62 Q 98 62 98 70 Q 98 78 90 81" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
          <circle cx="90" cy="92" r="3" fill="currentColor" opacity="0.75" />
          {/* animation disabled via CSS under prefers-reduced-motion */}
          <g className="notfound-stars">
            <circle cx="30"  cy="30"  r="2"   fill="currentColor" opacity="0.3" />
            <circle cx="165" cy="22"  r="1.5" fill="currentColor" opacity="0.3" />
            <circle cx="178" cy="70"  r="1"   fill="currentColor" opacity="0.25" />
            <circle cx="20"  cy="100" r="1.5" fill="currentColor" opacity="0.2" />
            <circle cx="155" cy="120" r="1"   fill="currentColor" opacity="0.25" />
          </g>
        </svg>

        <h1 id="notfound-title" className="error-title">Page not found</h1>
        <p className="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {suggestion && (
          <p className="error-details">
            Did you mean{" "}
            <Link
              to={suggestion.path}
              aria-label={`Go to ${suggestion.pageName} (${suggestion.path})`}
            >
              {suggestion.pageName} ({suggestion.path})
            </Link>
            ?
          </p>
        )}

        <div className="error-actions">
          {canGoBack ? (
            <button
              className="error-btn error-btn-primary"
              onClick={() => window.history.go(-1)}
              aria-label="Go back to previous page"
            >
              Go back
            </button>
          ) : (
            <Link
              to="/"
              className="error-btn error-btn-primary"
              aria-label="Go to Dashboard"
            >
              Go to Dashboard
            </Link>
          )}
          <a
            href="mailto:support@creditra.com"
            className="error-btn error-btn-secondary"
            aria-label="Contact support via email"
          >
            Contact Support
          </a>
        </div>

      </div>
    </main>
  );
}