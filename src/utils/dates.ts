/**
 * Small, dependency-free date helpers.
 *
 * We deliberately avoid pulling in moment / dayjs / luxon — the few
 * formatting needs across the app can be served by `Intl.*` plus the
 * helpers here.
 */

const DEFAULT_LOCALE = "en-US";

/**
 * Return a human-friendly "time ago" string (e.g. `"3 minutes ago"`,
 * `"2 days ago"`). Uses the browser's `Intl.RelativeTimeFormat` where
 * available.
 */
export function timeAgo(
  iso: string | Date,
  now: Date = new Date(),
  locale: string = DEFAULT_LOCALE,
): string {
  const then = iso instanceof Date ? iso : new Date(iso);
  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, secondsPerUnit] of units) {
    if (absSeconds >= secondsPerUnit || unit === "second") {
      const value = Math.round(diffSeconds / secondsPerUnit);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, "second");
}

/**
 * Return `true` when the given ISO timestamp falls on the same calendar
 * day as `reference` (defaults to today).
 */
export function isSameDay(
  iso: string | Date,
  reference: Date = new Date(),
): boolean {
  const date = iso instanceof Date ? iso : new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

// ─── Countdown helpers ────────────────────────────────────────────────────────

/**
 * Format a future ISO timestamp as a compact countdown string for inline
 * chips (e.g. "2h 14m", "3d", "45m"). Omits zero-valued units so the
 * label stays short. Falls back to "now" when the target is in the past.
 */
export function formatCountdown(
  targetIso: string | Date,
  now: Date = new Date(),
): string {
  const target = targetIso instanceof Date ? targetIso : new Date(targetIso);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "now";

  const totalSeconds = Math.ceil(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

/**
 * Return a full-sentence accessible label for screen readers describing
 * when the next interest accrual will occur, e.g.
 * "Next interest in 2 hours 14 minutes". Falls back to
 * "Interest is accruing now" for past dates.
 */
export function getCountdownAriaLabel(
  targetIso: string | Date,
  now: Date = new Date(),
  locale: string = DEFAULT_LOCALE,
): string {
  const target = targetIso instanceof Date ? targetIso : new Date(targetIso);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Interest is accruing now";
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const totalSeconds = Math.ceil(diffMs / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, secondsPerUnit] of units) {
    const value = Math.floor(totalSeconds / secondsPerUnit);
    if (value > 0 || unit === "minute") {
      const formatted = rtf.format(value, unit);
      const cleaned = formatted.replace(/^in\s+/, "");
      return `Next interest in ${cleaned}`;
    }
  }

  return `Next interest in ${rtf.format(0, "second")}`;
}

/**
 * Return a locale-aware relative label for a past timestamp.
 *
 * Examples:
 *   – just now          (< 10 s ago)
 *   – 3 minutes ago
 *   – 2 hours ago
 *   – yesterday
 *   – Jun 12            (same year, > 1 day)
 *   – Jun 12, 2024      (different year)
 *
 * Uses `Intl.RelativeTimeFormat` for the short-range cases and
 * `Intl.DateTimeFormat` for anything older than 24 h, so the string
 * is always locale-correct without a third-party library.
 *
 * @public Exported for use in `LastActivityStamp` and any future component
 *         that needs a human-readable "time ago" label.
 */
export function formatRelative(
  ts: Date | string | number,
  now: Date = new Date(),
  locale: string = DEFAULT_LOCALE,
): string {
  const then = ts instanceof Date ? ts : new Date(ts);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 10) return "just now";

  if (diffSec < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -diffSec,
      "second",
    );
  }

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -diffMin,
      "minute",
    );
  }

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -diffHr,
      "hour",
    );
  }

  if (diffHr < 48) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -1,
      "day",
    );
  }

  // Older than 48 h → absolute date
  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(then);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(
  date: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  const result = new Date(d.setDate(d.getDate() - diff));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Return a full, locale-aware absolute datetime string suitable for tooltip
 * or `<time datetime="…">` attributes.
 *
 * Examples:
 *   – "Jan 15, 2025, 2:32 PM"
 *   – "Dec 3, 2024, 10:05 AM"
 *
 * Renders month/day/year + 12-hour clock with AM/PM.
 * No seconds are shown — the precision isn't needed in tooltips.
 */
export function formatAbsolute(
  ts: Date | string | number,
  locale: string = DEFAULT_LOCALE,
): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// ─── Calendar grouping (issue #1189) ─────────────────────────────────────────

/**
 * ISO-ish string/Date input that `getCalendarGroup` accepts.
 */
export type CalendarGroupInput = string | Date;

/**
 * Buckets a timestamp lands in, computed against **local calendar boundaries**
 * (not 24-hour elapsed). Fixed display order.
 */
export type CalendarGroup =
  | "Upcoming"
  | "Today"
  | "Yesterday"
  | "This Week"
  | "This Month"
  | "Older"
  | "Unknown date";

export interface GetCalendarGroupOptions {
  /** 0 = Sunday (default), 1 = Monday, … 6 = Saturday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Return the calendar bucket for `iso` relative to `now`.
 *
 * Unlike a naive `(now - iso) / 24h` computation, this compares **local
 * calendar boundaries** (start of day / week / month), so a transaction from
 * yesterday 23:30 viewed at 00:15 today is **"Yesterday"**, not "Today".
 *
 * - `Upcoming` — `iso > now` (future dated / clock skew)
 * - `Today`    — same local calendar day as `now`
 * - `Yesterday`— prior local calendar day
 * - `This Week`— within the current local week (starting `weekStartsOn`, default Sunday)
 * - `This Month`— within the current local calendar month
 * - `Older`    — before `startOfMonth(now)`
 * - `Unknown date` — `iso` does not parse to a valid date
 *
 * `weekStartsOn` defaults to `0` (Sunday) so grouping matches the
 * "This Week" filter in `TransactionHistory`.
 */
export function getCalendarGroup(
  iso: CalendarGroupInput,
  now: Date,
  options: GetCalendarGroupOptions = {},
): CalendarGroup {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const { weekStartsOn = 0 } = options;

  if (date.getTime() > now.getTime()) return "Upcoming";

  const todayStart = startOfDay(now).getTime();
  const dateStart = startOfDay(date).getTime();

  if (dateStart === todayStart) return "Today";

  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  if (dateStart === yesterdayStart) return "Yesterday";

  const weekStart = startOfWeek(now, weekStartsOn).getTime();
  if (dateStart >= weekStart) return "This Week";

  const monthStart = startOfMonth(now).getTime();
  if (dateStart >= monthStart) return "This Month";

  return "Older";
}

/**
 * Relative-time formatter that is correct for future timestamps (#1189).
 *
 * - under 1 minute → `"just now"`
 * - past → `"3m ago"`, `"2h ago"`, `"5d ago"`
 * - future → `"in 3m"`, `"in 2h"`
 * - ≥ 7 days → absolute date via `Intl.DateTimeFormat`
 */
export function relativeTime(
  iso: CalendarGroupInput,
  now: Date = new Date(),
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const diffMs = now.getTime() - date.getTime();
  const isFuture = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const absSec = Math.floor(absMs / 1000);

  if (absSec < 60) return "just now";

  const absMin = Math.floor(absSec / 60);
  if (absMin < 60) return isFuture ? `in ${absMin}m` : `${absMin}m ago`;

  const absHr = Math.floor(absMin / 60);
  if (absHr < 24) return isFuture ? `in ${absHr}h` : `${absHr}h ago`;

  const absDay = Math.floor(absHr / 24);
  if (absDay < 7) return isFuture ? `in ${absDay}d` : `${absDay}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
