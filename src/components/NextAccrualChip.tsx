/**
 * NextAccrualChip
 *
 * Small pill that announces when the next interest accrual run lands on a
 * credit line.  Used inside `CreditLines` cards.  Falls back to an absolute
 * date if the relative-time bucket string can't be produced (very far future
 * or invalid ISO), and renders nothing when `target` is falsy so the parent
 * can drop it in conditionally without extra guards.
 */

import { relativeTime } from "../utils/tokens";

interface NextAccrualChipProps {
  /** ISO date string (e.g. "2025-02-15T00:00:00Z") of the next accrual. */
  target: string;
  /** Optional className override — defaults to the design-system pill style. */
  className?: string;
}

export function NextAccrualChip({
  target,
  className = "cl-next-accrual-chip",
}: NextAccrualChipProps) {
  if (!target) return null;

  const date = new Date(target);
  if (Number.isNaN(date.getTime())) return null;

  // Prefer the relative bucket ("3 m ago", "2 h ago", "5 d ago") for at-a-
  // glance scanning; `relativeTime` falls back to a parsed date for far-future
  // or invalid inputs.  Pass `target` (ISO string) — `relativeTime`'s
  // signature accepts the ISO form, not a Date.
  const label = relativeTime(target) ?? date.toLocaleDateString();

  return (
    <span
      className={className}
      role="status"
      aria-label={`Next interest accrual on ${date.toDateString()}`}
      title={date.toDateString()}
    >
      Next accrual: <span className="cl-next-accrual-chip__when">{label}</span>
    </span>
  );
}
