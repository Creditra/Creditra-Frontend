/**
 * NotificationBell — header trigger button for the notification center.
 *
 * Exposes its internal button ref via React.forwardRef so the parent
 * NotificationWidget can pass it to NotificationCenter as `triggerRef`,
 * enabling correct return-focus when the panel closes.
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { useReducedMotion } from "../../context/ReducedMotionContext";
import "./NotificationBell.css";

interface NotificationBellProps {
  /** Optional custom label for the accessible name. Defaults to "Notifications". */
  label?: string;
}

export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  function NotificationBell({ label = "Notifications" }: NotificationBellProps, ref) {
    const { unreadCount, isPanelOpen, openPanel, notifications } = useNotifications();
    const { isReducedMotionActive } = useReducedMotion();

    // Track previous unread error/warning count to detect new high-priority arrivals
    const prevHighPriorityUnreadRef = useRef(0);
    const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showPulse, setShowPulse] = useState(false);

    // Internal fallback ref used only for the return-focus side-effect below.
    // When a forwarded ref is provided the parent manages focus return instead.
    const internalRef = useRef<HTMLButtonElement>(null);
    const buttonRef = (ref ?? internalRef) as React.RefObject<HTMLButtonElement>;
    const hadPanelOpen = useRef(false);

    // Compute current high-priority (error/danger/warning) unread count
    const highPriorityUnreadCount = notifications.filter(
      (n) => !n.read && (n.type === "error" || n.type === "danger" || n.type === "warning")
    ).length;

    // Detect new high-priority unread notifications and trigger one-shot pulse
    useEffect(() => {
      if (highPriorityUnreadCount > prevHighPriorityUnreadRef.current) {
        // New high-priority unread notification arrived
        if (!isReducedMotionActive) {
          setShowPulse(true);
          
          // Clear any existing timer
          if (pulseTimerRef.current) {
            clearTimeout(pulseTimerRef.current);
          }
          
          // One-shot: remove pulse after 650ms
          pulseTimerRef.current = setTimeout(() => {
            setShowPulse(false);
            pulseTimerRef.current = null;
          }, 650);
        } else {
          // Reduced motion: still toggle class but immediately remove (no animation)
          setShowPulse(true);
          // Still need to clear the class for test assertion
          pulseTimerRef.current = setTimeout(() => {
            setShowPulse(false);
            pulseTimerRef.current = null;
          }, 0);
        }
      }
      prevHighPriorityUnreadRef.current = highPriorityUnreadCount;
    }, [highPriorityUnreadCount, isReducedMotionActive]);

    // Cleanup timer on unmount
    useEffect(() => {
      return () => {
        if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = null;
        }
      };
    }, []);

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

    const className = ["notif-bell", showPulse ? "bell-pulse" : ""].filter(Boolean).join(" ");

    return (
      <button
        ref={buttonRef}
        className={className}
        type="button"
        onClick={openPanel}
        aria-label={`${label}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
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
