import { useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationCategory } from '../types/notification';

interface ToastOptions {
  /** Category controls per-preference muting. Defaults to 'system'. */
  category?: NotificationCategory;
  /** Auto-dismiss delay in ms. Defaults to 5 500. */
  duration?: number;
  /** When true the toast stays until manually dismissed. */
  persistent?: boolean;
  /** Optional inline call-to-action rendered inside the toast. */
  action?: { label: string; onClick: () => void };
}

/**
 * Convenience wrapper around `useNotifications().addToast`.
 *
 * Usage:
 * ```ts
 * const toast = useToast();
 * toast.success('Repayment sent', 'Your payment is being processed.');
 * toast.error('Connection failed', 'Could not reach the Stellar network.');
 * toast.danger('Access denied', 'Your session has expired.');
 * ```
 *
 * All helpers return the toast id so callers can dismiss programmatically
 * via `toast.dismiss(id)` when needed.
 *
 * Severity semantics:
 * - `success` / `info` / `warning` — polite announcements (role="status").
 * - `error` / `danger` — assertive interruptions (role="alert"). Use these
 *   sparingly; they immediately interrupt AT users.
 *   `danger` vs `error`: both render identically (same red token). Prefer
 *   `danger` for destructive-action confirmations and security events;
 *   prefer `error` for unexpected system failures.
 */
export function useToast() {
  const { addToast, dismissToast } = useNotifications();

  const success = useCallback(
    (title: string, message: string, opts?: ToastOptions) =>
      addToast({ type: 'success', title, message, ...opts }),
    [addToast],
  );

  const error = useCallback(
    (title: string, message: string, opts?: ToastOptions) =>
      addToast({ type: 'error', title, message, ...opts }),
    [addToast],
  );

  const warning = useCallback(
    (title: string, message: string, opts?: ToastOptions) =>
      addToast({ type: 'warning', title, message, ...opts }),
    [addToast],
  );

  const info = useCallback(
    (title: string, message: string, opts?: ToastOptions) =>
      addToast({ type: 'info', title, message, ...opts }),
    [addToast],
  );

  /**
   * Assertive (role="alert") toast for destructive actions or security
   * events. Shares the same red design token as `error` but is
   * semantically distinct: "danger" = intended but severe consequence;
   * "error" = unexpected system failure.
   */
  const danger = useCallback(
    (title: string, message: string, opts?: ToastOptions) =>
      addToast({ type: 'danger', title, message, ...opts }),
    [addToast],
  );

  return {
    success,
    error,
    warning,
    info,
    danger,
    dismiss: dismissToast,
  };
}
