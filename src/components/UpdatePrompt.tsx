import { useRegisterSW } from "virtual:pwa-register/react";
import "./UpdatePrompt.css";

/**
 * User-controlled PWA update banner.
 *
 * Registers the service worker via `virtual:pwa-register/react` and surfaces
 * a non-intrusive toast when a new deployment is waiting to activate.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  const handleReload = () => {
    void updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div
      className="update-prompt"
      role="status"
      aria-live="polite"
      aria-label="Application update available"
    >
      <div className="update-prompt__content">
        <span>New version available</span>
        <div className="update-prompt__actions">
          <button
            type="button"
            onClick={handleReload}
            className="update-prompt__reload-button"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="update-prompt__dismiss-button"
            aria-label="Dismiss update notification"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
