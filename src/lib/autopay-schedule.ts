export type AutopayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

const FREQ_DAYS: Record<AutopayFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 0,
  quarterly: 0,
};

const FREQ_MONTHS: Record<AutopayFrequency, number> = {
  weekly: 0,
  biweekly: 0,
  monthly: 1,
  quarterly: 3,
};

/**
 * Parses a date string as a local calendar date.
 *
 * `new Date('2024-01-31')` is parsed as UTC midnight, which shifts the day in
 * negative-offset time zones. Date-only autopay values are calendar dates, so
 * they must be constructed in local time.
 */
export function parseLocalDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Number of calendar days in `month` (0-indexed) of `year`. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Adds whole months to `date`, clamping the day to the target month's last day.
 *
 * Computing from the original date (rather than chaining from the previous
 * occurrence) prevents the 31st from drifting to the 2nd after a short month.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetIndex / 12);
  const month = ((targetIndex % 12) + 12) % 12;
  const day = Math.min(date.getDate(), daysInMonth(year, month));

  return new Date(
    year,
    month,
    day,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Advances `date` by `steps` frequency intervals, clamping month-end dates. */
export function advanceByFrequency(
  date: Date,
  frequency: AutopayFrequency,
  steps = 1,
): Date {
  if (frequency === 'monthly' || frequency === 'quarterly') {
    return addMonthsClamped(date, FREQ_MONTHS[frequency] * steps);
  }
  return addDays(date, FREQ_DAYS[frequency] * steps);
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Builds an ordered list of upcoming payment dates.
 *
 * Every occurrence is derived from the original start date, so month-end and
 * leap-day starts clamp to each target month's last day without drifting.
 */
export function buildSchedule(
  startDate: string,
  frequency: AutopayFrequency,
  endDate?: string,
  maxRows = 8,
): Date[] {
  const start = parseLocalDate(startDate);
  if (!start || maxRows <= 0) return [];

  const end = endDate ? parseLocalDate(endDate) : null;
  if (endDate && !end) return [];

  const endKey = end ? localDateKey(end) : null;
  const dates: Date[] = [];

  for (let occurrence = 0; dates.length < maxRows; occurrence++) {
    const cursor = advanceByFrequency(start, frequency, occurrence);
    if (endKey && localDateKey(cursor) > endKey) break;
    dates.push(cursor);
  }

  return dates;
}

/** Formats a Date as a local `YYYY-MM-DD` key (no UTC shift). */
export function toLocalDateString(date: Date): string {
  return localDateKey(date);
}

/** Formats a Date as a local ISO-like timestamp accepted by `new Date()`. */
export function toLocalDateTimeString(date: Date): string {
  const time = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
  return `${localDateKey(date)}T${time}`;
}
