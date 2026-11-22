import type { CreditLine, CreditLineStatus } from "../types/creditLine";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function isDelinquent(status: CreditLineStatus): boolean {
  return status === "Suspended" || status === "Defaulted";
}

function parseLocalDate(date: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(date);

  if (Number.isNaN(parsed.getTime())) return null;
  if (
    dateOnly &&
    (parsed.getFullYear() !== Number(dateOnly[1]) ||
      parsed.getMonth() !== Number(dateOnly[2]) - 1 ||
      parsed.getDate() !== Number(dateOnly[3]))
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS;
}

export function getDelinquencyStartDate(
  line: CreditLine,
  now: Date = new Date(),
): Date | null {
  if (!isDelinquent(line.status)) return null;

  let episodeStart: Date | null = null;
  let previousStatus: CreditLineStatus | null = null;

  for (const entry of line.statusHistory) {
    if (isDelinquent(entry.status)) {
      if (previousStatus === null || !isDelinquent(previousStatus)) {
        episodeStart = parseLocalDate(entry.date);
      }
    } else {
      episodeStart = null;
    }
    previousStatus = entry.status;
  }

  const missedPaymentDate = line.nextPaymentDate
    ? parseLocalDate(line.nextPaymentDate)
    : null;
  const today = Number.isNaN(now.getTime()) ? null : calendarDayNumber(now);
  const validMissedPaymentDate =
    missedPaymentDate &&
    today !== null &&
    calendarDayNumber(missedPaymentDate) <= today
      ? missedPaymentDate
      : null;

  if (
    validMissedPaymentDate &&
    (!episodeStart ||
      calendarDayNumber(validMissedPaymentDate) <
        calendarDayNumber(episodeStart))
  ) {
    return validMissedPaymentDate;
  }

  return episodeStart;
}

export function getDaysPastDue(
  line: CreditLine,
  now: Date = new Date(),
): number | null {
  const startDate = getDelinquencyStartDate(line, now);
  if (!startDate) return null;
  if (Number.isNaN(now.getTime())) return 0;

  return Math.max(
    0,
    calendarDayNumber(now) - calendarDayNumber(startDate),
  );
}
