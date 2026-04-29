import React from 'react';

interface PendingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}

/**
 * PendingButton — standardized submit/async action button.
 *
 * Rules:
 * - Shows an inline spinner (left of label) while pending; no layout shift.
 * - Sets disabled + aria-busy=true while pending to prevent double-submission.
 * - Spinner is aria-hidden; the visible label change communicates state to screen readers.
 * - Caller controls all styling via className; this component adds no visual opinions.
 */
export function PendingButton({
  pending,
  pendingLabel,
  children,
  disabled,
  className = '',
  ...rest
}: PendingButtonProps) {
  return (
    <button
      {...rest}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`pending-btn ${className}`}
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
  );
}
