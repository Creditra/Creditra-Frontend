/**
 * NotificationBell — header trigger button for the notification center.
 *
 * Exposes its internal button ref via React.forwardRef so the parent
 * NotificationWidget can pass it to NotificationCenter as `triggerRef`,
 * enabling correct return-focus when the panel closes.
 *
 * Plays a one-shot pulse ring when a NEW high-priority (danger/error)
 * notification arrives (issue #219). The pulse is purely visual — the
 * unread badge + live-region announcements carry the meaning, so it is
 * WCAG 1.4.1 (Use of Color) safe. Under `prefers-reduced-motion: reduce`
 * the animation is replaced by a brief static border flash.
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import "./NotificationBell.css";

interface NotificationBellProps {
  /** Accessible label for the button (defaults to "Notifications"). */
  label?: string;
}

export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  function NotificationBell({ label = "Notifications" }, ref) {
    const { unreadCount, isPanelOpen, openPanel, notifications } = useNotifications();

    // One-shot pulse state — set true on a new high-priority arrival,
    // cleared after the 650 ms animation so the next arrival re-triggers.
    const [isPulsing, setIsPulsing] = useState(false);
    const lastPulsedIdRef = useRef<string | null>(null);
    // Timer kept in a ref (NOT coupled to the effect cleanup below) so a
    // mid-animation `notifications` change can't cancel the pulse early.
    const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Internal fallback ref used only for the return-focus side-effect below.
    // When a forwarded ref is provided the parent manages focus return instead.
    const internalRef = useRef<HTMLButtonElement>(null);
    const buttonRef = (ref ??
      internalRef) as React.RefObject<HTMLButtonElement>;
    const hadPanelOpen = useRef(false);

    useEffect(() => {
      if (isPanelOpen) {
        hadPanelOpen.current = true;
        return;
      }
      // When no triggerRef is forwarded to NotificationCenter, fall back to
      // returning focus here (original behaviour).
      if (hadPanelOpen.current && !ref) {
        buttonRef.current?.focus();
        hadPanelOpen.current = false;
      }
    }, [isPanelOpen, ref, buttonRef]);

    // ── Pulse trigger ──────────────────────────────────────────────────────
    useEffect(() => {
      // `notifications` is newest-first, so find() returns the most recent
      // high-priority item. Pulse once per ARRIVAL id, not per render.
      const latest = notifications.find(
        (n) => n.type === "danger" || n.type === "error",
      );
      if (!latest || latest.id === lastPulsedIdRef.current) return;

      lastPulsedIdRef.current = latest.id;
      setIsPulsing(true);

      // Remove the class after the animation completes (650 ms) so another
      // high-priority arrival can pulse again. Managed via a ref so the
      // cleanup below only clears it on unmount — re-runs of this effect
      // (e.g. markAsRead mutating `notifications`) must NOT kill an active
      // pulse, or `.bell-pulse` would stick on forever.
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setIsPulsing(false), 650);
    }, [notifications]);

    // Clear the pulse timer on unmount only.
    useEffect(
      () => () => {
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      },
      [],
    );

    return (
      <button
        ref={buttonRef}
        className={isPulsing ? "notif-bell bell-pulse" : "notif-bell"}
        type="button"
        onClick={openPanel}
        aria-label={`${label}${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isPanelOpen}
        aria-controls="notification-center"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  },
);
