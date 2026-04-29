import { useNotifications } from "../../context/NotificationContext";
import { TYPE_COLOR, TYPE_ICON } from "./notificationIcons";
import "./BannerAlert.css";

export function BannerAlerts() {
  const { banners, dismissBanner } = useNotifications();

  if (banners.length === 0) return null;

  return (
    <div className="banner-stack">
      {banners.map((banner) => {
        const colors = TYPE_COLOR[banner.type];
        return (
          <div
            key={banner.id}
            className="banner-alert"
            style={{ background: colors.bg, borderColor: colors.border }}
            role="alert"
          >
            <span
              className="banner-icon"
              style={{ color: colors.icon }}
              aria-hidden="true"
            >
              {TYPE_ICON[banner.type]}
            </span>
            <span className="banner-message">{banner.message}</span>
            {banner.action && (
              <button
                className="banner-action"
                style={{ color: colors.text }}
                onClick={banner.action.onClick}
              >
                {banner.action.label}
              </button>
            )}
            {banner.dismissible !== false && (
              <button
                className="banner-close"
                onClick={() => dismissBanner(banner.id)}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
