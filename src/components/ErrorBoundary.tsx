import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import "../pages/ErrorPage.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

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

  public render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} />;
    }

    return this.props.children;
  }
}

interface ErrorPageProps {
  error?: Error;
}

function ErrorPage({ error }: ErrorPageProps) {
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
