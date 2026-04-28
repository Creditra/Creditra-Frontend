import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import type { Toast } from "../../types/notification";
import { TYPE_COLOR, TYPE_ICON } from "./notificationIcons";
import "./ToastContainer.css";

function ToastItem({
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
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  // Progress bar
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

  return (
    <div
      className={`toast-item ${visible ? "toast-enter" : ""} ${leaving ? "toast-leave" : ""}`}
      style={{ borderColor: colors.border }}
      role="alert"
      aria-live={
        toast.type === "error" || toast.type === "danger"
          ? "assertive"
          : "polite"
      }
    >
      <div className="toast-header">
        <span
          className="toast-type-icon"
          style={{ background: colors.bg, color: colors.icon }}
        >
          {TYPE_ICON[toast.type]}
        </span>
        <span className="toast-title">{toast.title}</span>
        <button
          className="toast-close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
      <p className="toast-message">{toast.message}</p>
      {toast.action && (
        <button
          className="toast-action"
          style={{ color: colors.text }}
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
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
