import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import "../pages/ErrorPage.css";

interface Props {
  /** Application subtree to guard. */
  children: ReactNode;
}

interface State {
  /** True after an error was thrown by a descendant render. */
  hasError: boolean;
  /** The error that was thrown, if any — used to render diagnostic info. */
  error?: Error;
}

/**
 * Top-level render-error boundary, mounted as the outermost wrapper in
 * `src/App.tsx`.
 *
 * Catches any error thrown during render in the subtree and renders the
 * fallback `ErrorPage` instead of letting React unmount the root. The
 * original error is captured into local state for display and logged to
 * the console in `componentDidCatch`.
 *
 * Why a class component: React still requires error boundaries to be
 * class components. There is no hook equivalent today.
 *
 * Does NOT catch:
 * - errors thrown in event handlers (use try/catch locally)
 * - errors thrown asynchronously after render (e.g. `setTimeout`)
 * - errors thrown inside the boundary's own render
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  /**
   * Resets the error state so the boundary re-renders its children.
   * Useful for "Try Again" / retry actions that should attempt to
   * recover without a full page reload.
   */
  public resetError = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} onRetry={this.resetError} />;
    }

    return this.props.children;
  }
}

interface ErrorPageProps {
  error?: Error;
  /** Called when the user clicks "Try Again" — resets the error boundary
   *  so the component subtree re-renders without a full page reload. */
  onRetry?: () => void;
}

function ErrorPage({ error, onRetry }: ErrorPageProps) {
  const handleGoBack = () => {
    window.history.back();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="error-page">
      <div className="error-content">
        <div className="error-icon" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="error-title">Something went wrong</h1>
        <p className="error-message">
          We encountered an unexpected error. Our team has been notified and is
          working to fix it.
        </p>
        {!error && (
          <p className="error-details">
            If this problem persists, please contact our support team.
          </p>
        )}
        <div className="error-actions">
          {onRetry && (
            <button
              className="error-btn error-btn-primary"
              onClick={onRetry}
              aria-label="Try again to render the content"
            >
              Try Again
            </button>
          )}
          <button
            className="error-btn error-btn-secondary"
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
          <button
            className="error-btn error-btn-secondary"
            onClick={handleReload}
            aria-label="Reload the page"
          >
            Reload Page
          </button>
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
