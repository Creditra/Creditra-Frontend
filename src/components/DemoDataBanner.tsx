import { useState } from "react";
import { isDemoData } from "../services/credit/config";
import { TYPE_COLOR, TYPE_ICON } from "./notifications/notificationIcons";
import "./DemoDataBanner.css";

const SESSION_KEY = "demoDataBannerDismissed";

/**
 * Persistent banner shown whenever the app is running against the mock credit
 * data source (i.e. VITE_CREDIT_DATA_SOURCE is not set to "soroban").
 *
 * Dismissal is session-scoped — the banner reappears on a fresh page load so
 * the user is never permanently unaware they are looking at demo data.
 */
export function DemoDataBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "true",
  );

  // Render nothing in soroban (live) mode or after a session-scoped dismissal.
  if (!isDemoData() || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setDismissed(true);
  };

  const colors = TYPE_COLOR["info"];
  const icon = TYPE_ICON["info"];

  return (
    <div className="demo-data-banner-stack">
      <div
        className="banner-alert demo-data-banner"
        style={{ background: colors.bg, borderColor: colors.border }}
        role="status"
        aria-label="Demo data active"
      >
        <span
          className="banner-icon"
          style={{ color: colors.icon }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="banner-message">
          <strong>Demo data</strong> — you are viewing simulated credit data,
          not live chain data.{" "}
          <a
            href="/help"
            className="demo-data-banner__link"
            style={{ color: colors.text }}
          >
            Learn more
          </a>
        </span>
        <button
          type="button"
          className="banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss demo data notice"
        >
          ×
        </button>
      </div>
    </div>
  );
}
