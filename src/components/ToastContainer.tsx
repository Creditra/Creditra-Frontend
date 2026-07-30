/**
 * Centralized accessible toast queue for the application.
 *
 * Mount this component once in the app root (e.g. inside
 * `<NotificationProvider>`) to render all active toasts in a
 * `role="status"` live region.
 *
 * ## Accessibility (WCAG 2.1 AA)
 *
 * - The outer container carries `role="status"` so screen readers can
 *   identify this region as a status landmark (SC 4.1.3 – Status Messages).
 * - `aria-live="polite"` ensures new toasts are announced when the AT
 *   is idle, without interrupting the user's current task.
 * - `aria-atomic="true"` tells AT to read the region as a whole unit.
 * - Each individual toast item carries its own `role="status"` (for
 *   success / info / warning) or `role="alert"` (for error / danger),
 *   which drives the actual per-toast announcement — see `ToastItem` in
 *   `./notifications/ToastContainer.tsx`.
 * - The container has `aria-label="Notifications"` so AT users can
 *   identify the region when navigating by landmark.
 *
 * The container does NOT set `aria-relevant="additions"` because each
 * child ToastItem already has its own live-region role; restricting the
 * parent to only additions would cause unpredictable behaviour across
 * different screen readers (some would double-announce, others would
 * defer to the child and behave correctly).
 *
 * ## Usage
 *
 * ```tsx
 * import { ToastContainer } from './components/ToastContainer';
 *
 * function App() {
 *   return (
 *     <NotificationProvider>
 *       <ToastContainer />
 *       <Routes>…</Routes>
 *     </NotificationProvider>
 *   );
 * }
 * ```
 *
 * ## Responsive behaviour
 *
 * - The queue is fixed-positioned at the top-right of the viewport.
 * - On mobile (≤ 640 px) it respects safe-area insets (`--sat`, `--sar`)
 *   for notched devices.
 * - `max-width` is constrained to `calc(100vw - 2.5rem)` so it never
 *   overflows the viewport.
 * - Stack is capped at 5 toasts (enforced by `NotificationContext`).
 *
 * ## Future enhancements
 *
 * - Add a `position` prop to support bottom-left or bottom-right
 *   placement.
 * - Support toast stacking direction (top-to-bottom vs bottom-to-top).
 */

import { ToastItem } from "./notifications/ToastContainer";
import { useNotifications } from "../context/NotificationContext";
import "./notifications/ToastContainer.css";

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  return (
    /*
     * role="status" + aria-live="polite" = WCAG 4.1.3 Status Message.
     * The region politely announces new content when the AT is idle,
     * without interrupting the user's current task.
     *
     * aria-atomic="true" provides a hint that the region should be read
     * as a complete unit.
     *
     * Each individual ToastItem carries its own role/aria-live for
     * per-toast announcements. This container serves as a labelled
     * landmark region that AT users can navigate to, and as a fallback
     * live region for aggregate changes.
     */
    <div
      className="toast-container"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
