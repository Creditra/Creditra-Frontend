import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import type { Toast } from "../../types/notification";
import { TYPE_COLOR, TYPE_ICON } from "./notificationIcons";
import "./ToastContainer.css";

export function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const colors = TYPE_COLOR[toast.type];

  useEffect(() => {
    // Defer one frame so the initial opacity:0 is painted before we
    // add .toast-enter, giving the CSS transition something to animate.
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setLeaving(true);
    // Wait for the leave transition (0.3 s) before removing from DOM.
    // Under prefers-reduced-motion:reduce the CSS sets transition:none,
    // so the element disappears instantly and the 300 ms delay is merely
    // cosmetic — acceptably short.
    setTimeout(() => onDismiss(toast.id), 300);
  };

  // ── Progress bar ──────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const duration = toast.duration ?? 5500;

  useEffect(() => {
    if (toast.persistent) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [toast.persistent, duration]);

  /*
   * Role / live-region semantics (WCAG 4.1.3 Status Messages):
   *   role="alert"  aria-live="assertive"  — interrupts AT immediately;
   *                 reserved for error / danger toasts.
   *   role="status" aria-live="polite"     — waits for idle; used for
   *                 success, info, and warning toasts.
   *
   * The severity CSS class drives the tinted background. It is applied
   * alongside the animation state classes so they compose cleanly.
   */
  const isUrgent = toast.type === "error" || toast.type === "danger";
  const severityClass = `toast-item--${toast.type}`;

  return (
    <div
      className={[
        "toast-item",
        severityClass,
        visible ? "toast-enter" : "",
        leaving ? "toast-leave" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: colors.border,
        /* Left accent bar reinforces severity via color in addition to the
           icon, satisfying WCAG 1.4.1 (Use of Color). */
        borderLeft: `4px solid ${colors.icon}`,
      }}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      <div className="toast-header">
        {/*
         * The Lucide icon is purely decorative alongside the title text.
         * The wrapper span carries aria-hidden="true" so AT skips it;
         * the icon components also set aria-hidden internally (see
         * notificationIcons.tsx) as a redundant belt-and-suspenders guard.
         */}
        <span
          className="toast-type-icon"
          style={{ background: colors.bg, color: colors.icon }}
          aria-hidden="true"
        >
          {TYPE_ICON[toast.type]}
        </span>

        <span className="toast-title">{toast.title}</span>

        <button
          className="toast-close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          type="button"
        >
          ×
        </button>
      </div>

      <p className="toast-message">{toast.message}</p>

      {toast.action && (
        <button
          className="toast-action"
          style={{ color: colors.text }}
          type="button"
          onClick={() => {
            toast.action!.onClick();
            handleDismiss();
          }}
        >
          {toast.action.label} →
        </button>
      )}

      {!toast.persistent && (
        <div className="toast-progress-track">
          <div
            className="toast-progress-fill"
            style={{ width: `${progress}%`, background: colors.icon }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  return (
    /*
     * role="log" marks this region as an ordered sequence of status
     * messages so AT users can revisit the list without losing their
     * reading position (WCAG 4.1.3).
     */
    <div
      className="toast-container"
      role="log"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
