import React, { useId } from 'react';
import { useOnline } from '../hooks/useOnline';
import './PendingButton.css';

const DEFAULT_OFFLINE_REASON = "You're offline — reconnect to continue";

export interface PendingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * True while the parent's async action is in flight. Disables the
   * button, sets `aria-busy="true"`, and swaps the label.
   */
  pending: boolean;
  /**
   * Label shown while `pending` is true. Choose a verb form that names
   * what is happening (e.g. `Submitting`, `Confirming`) so screen
   * readers announce a meaningful state change.
   */
  pendingLabel: string;
  /** Idle-state label (i.e. the normal button label). */
  children: React.ReactNode;
  /**
   * When true, disables the button while the browser is offline and
   * associates an accessible offline reason via `aria-describedby`.
   */
  requiresOnline?: boolean;
  /**
   * Human-readable reason shown and linked via `aria-describedby` when
   * `requiresOnline` is true and the browser is offline.
   */
  offlineReason?: string;
  /**
   * Optional override for online status (defaults to `useOnline().isOnline`).
   * Useful for pure rendering and unit tests.
   */
  isOnline?: boolean;
}

/**
 * PendingButton — standardized submit/async action button.
 *
 * Rules:
 * - Shows an inline spinner (left of label) while pending; no layout shift.
 * - Sets disabled + aria-busy=true while pending to prevent double-submission.
 * - Spinner is aria-hidden; the visible label change communicates state to screen readers.
 * - When `requiresOnline` is true and offline, disables the button with a distinct
 *   `.pending-btn--offline` state and associates the reason via `aria-describedby`.
 */
export function PendingButton({
  pending,
  pendingLabel,
  children,
  disabled,
  className = '',
  requiresOnline = false,
  offlineReason,
  isOnline: isOnlineProp,
  'aria-describedby': ariaDescribedBy,
  'aria-disabled': ariaDisabled,
  ...rest
}: PendingButtonProps) {
  const { isOnline: hookIsOnline } = useOnline();
  const effectiveOnline = isOnlineProp ?? hookIsOnline;
  const isOfflineDisabled = Boolean(requiresOnline && !effectiveOnline);
  const offlineReasonId = useId();

  const resolvedOfflineReason =
    offlineReason && offlineReason.trim().length > 0
      ? offlineReason
      : DEFAULT_OFFLINE_REASON;

  const describedBy =
    [ariaDescribedBy, isOfflineDisabled ? offlineReasonId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  const isDisabled = Boolean(pending || disabled || isOfflineDisabled);
  const resolvedAriaDisabled = isOfflineDisabled ? true : ariaDisabled;
  const classes = [
    'pending-btn',
    isOfflineDisabled ? 'pending-btn--offline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        {...rest}
        disabled={isDisabled}
        aria-disabled={resolvedAriaDisabled}
        aria-busy={pending}
        aria-describedby={describedBy}
        className={classes}
      >
        {pending && (
          <svg
            className="pending-btn__spinner"
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <path
              d="M14 8a6 6 0 0 0-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        {pending ? pendingLabel : children}
      </button>
      {isOfflineDisabled && (
        <span
          id={offlineReasonId}
          className="pending-btn__offline-reason"
        >
          {resolvedOfflineReason}
        </span>
      )}
    </>
  );
}
