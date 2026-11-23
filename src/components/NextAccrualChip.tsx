/**
 * NextAccrualChip
 *
 * Small pill that announces when the next interest accrual run lands on a
 * credit line.  Used inside `CreditLines` cards.  Falls back to an absolute
 * date if the relative-time bucket string can't be produced (very far future
 * or invalid ISO), and renders nothing when `target` is falsy so the parent
 * can drop it in conditionally without extra guards.
 */

import { formatAbsolute, parseLocalDate } from "../utils/dates";
import { relativeTime } from "../utils/tokens";

const DEFAULT_LOCALE = "en-US";

function getActiveLocale(locale?: string): string {
  if (locale) return locale;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("locale");
      if (stored) return stored;
    } catch {
      // Ignore storage access errors (e.g. restricted environments)
    }
  }
  return DEFAULT_LOCALE;
}

interface NextAccrualChipProps {
  /** ISO date string (e.g. "2025-02-15T00:00:00Z" or "2025-02-15") of the next accrual. */
  target: string;
  /** Optional BCP 47 locale override — defaults to stored locale or "en-US". */
  locale?: string;
  /** Optional className override — defaults to the design-system pill style. */
  className?: string;
}

export function NextAccrualChip({
  target,
  locale,
  className = "cl-next-accrual-chip",
}: NextAccrualChipProps) {
  if (!target) return null;

  const date = parseLocalDate(target);
  if (!date) return null;

  const activeLocale = getActiveLocale(locale);
  const formattedDate = formatAbsolute(date, activeLocale);

  // Prefer the relative bucket ("3 m ago", "2 h ago", "5 d ago") for at-a-
  // glance scanning; `relativeTime` falls back to a parsed date for far-future
  // or invalid inputs.  Pass `target` (ISO string) — `relativeTime`'s
  // signature accepts the ISO form, not a Date.
  const label = relativeTime(target) ?? date.toLocaleDateString(activeLocale);

  return (
    <span
      className={className}
      role="status"
      aria-label={`Next interest accrual on ${formattedDate}`}
      title={formattedDate}
    >
      Next accrual: <span className="cl-next-accrual-chip__when">{label}</span>
    </span>
  );
}
