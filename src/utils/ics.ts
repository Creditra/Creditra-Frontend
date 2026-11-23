/**
 * Dependency-free RFC 5545 iCalendar (.ics) generator and download helper.
 *
 * Produces standards-compliant `.ics` files with:
 * - CRLF (`\r\n`) line endings
 * - 75-octet UTF-8-safe line folding (RFC 5545 §3.1)
 * - TEXT property value escaping (RFC 5545 §3.3.11)
 * - Deterministic UIDs (`${lineId}-${date}@creditra`) so re-importing updates
 *   existing events instead of creating duplicates
 * - All-day `VALUE=DATE` events with exclusive `DTEND`
 * - Optional `RRULE` recurrence for autopay schedules
 * - `VALARM` display reminders (default `-P1D` and `-PT9H`)
 */

import type { AutopayFrequency } from '../lib/autopay-schedule';

export const DEFAULT_PROD_ID = '-//Creditra//Repayment Calendar//EN';
export const DEFAULT_ALARMS: readonly string[] = ['-P1D', '-PT9H'];

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;

const textEncoder = new TextEncoder();

export interface IcsEventInput {
  /** Credit line identifier used to construct a stable UID. */
  lineId: string;
  /** Due date in `YYYY-MM-DD` (or ISO 8601) format. */
  date: string;
  /** Event title (`SUMMARY`). */
  summary: string;
  /** Optional detailed description (`DESCRIPTION`). */
  description?: string;
  /** Optional explicit UID override; defaults to `${lineId}-${date}@creditra`. */
  uid?: string;
  /** Optional explicit RFC 5545 `RRULE` value (e.g. `FREQ=MONTHLY`). */
  rrule?: string;
  /** Optional autopay frequency; converted to an `RRULE` when `rrule` is omitted. */
  frequency?: AutopayFrequency;
  /**
   * Optional list of RFC 5545 trigger durations for `VALARM` reminders.
   * Defaults to `['-P1D', '-PT9H']`. Pass `[]` to omit alarms.
   */
  alarms?: readonly string[];
}

export interface BuildIcsOptions {
  /** RFC 5545 `PRODID`. Defaults to `DEFAULT_PROD_ID`. */
  prodId?: string;
  /** Reference timestamp for `DTSTAMP`. Defaults to `new Date()`. */
  now?: Date;
}

/**
 * Map an `AutopayFrequency` to its RFC 5545 `RRULE` value.
 */
export function frequencyToRrule(frequency: AutopayFrequency): string {
  switch (frequency) {
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'biweekly':
      return 'FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
  }
}

/**
 * Escape a TEXT property value per RFC 5545 §3.3.11.
 *
 * Escapes backslashes, semicolons, commas, and line breaks.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Fold a single content line so no line exceeds 75 UTF-8 octets (RFC 5545 §3.1).
 *
 * Continuation lines begin with a single space (`0x20`), which counts toward
 * the 75-octet limit. Never splits a multi-byte UTF-8 character or surrogate pair.
 */
export function foldIcsLine(line: string): string {
  if (textEncoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line;
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = textEncoder.encode(char).length;
    if (currentBytes + charBytes > MAX_LINE_OCTETS && current.length > 0) {
      chunks.push(current);
      // Continuation line starts with a single space (1 octet).
      current = ` ${char}`;
      currentBytes = 1 + charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.join(CRLF);
}

/**
 * Format a `Date` as an RFC 5545 UTC timestamp (`YYYYMMDDTHHMMSSZ`).
 */
export function formatIcsTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Extract a normalized `YYYY-MM-DD` date string from a date-only or ISO string.
 * Returns `null` if the input cannot be parsed into a valid calendar date.
 */
function normalizeDateOnly(input: string): { year: number; month: number; day: number; iso: string } | null {
  const trimmed = input.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    iso: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

function formatIcsDate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}${pad(month)}${pad(day)}`;
}

function nextCalendarDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/**
 * Sanitize a credit line id for safe inclusion in a UID local-part.
 */
function sanitizeUidSegment(segment: string): string {
  const cleaned = segment.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned || 'creditra';
}

/**
 * Build a deterministic UID for a repayment event: `${lineId}-${date}@creditra`.
 */
export function buildEventUid(lineId: string, date: string): string {
  const normalized = normalizeDateOnly(date);
  const datePart = normalized ? normalized.iso : sanitizeUidSegment(date);
  return `${sanitizeUidSegment(lineId)}-${datePart}@creditra`;
}

/**
 * Build an RFC 5545 iCalendar (`.ics`) document from one or more events.
 *
 * Events with unparseable dates are skipped safely.
 */
export function buildIcs(
  events: readonly IcsEventInput[],
  options: BuildIcsOptions = {},
): string {
  const prodId = options.prodId ?? DEFAULT_PROD_ID;
  const now = options.now ?? new Date();
  const dtstamp = formatIcsTimestamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    const parsed = normalizeDateOnly(event.date);
    if (!parsed) continue;

    const dtStart = formatIcsDate(parsed.year, parsed.month, parsed.day);
    const next = nextCalendarDay(parsed.year, parsed.month, parsed.day);
    const dtEnd = formatIcsDate(next.year, next.month, next.day);
    const uid = event.uid ?? buildEventUid(event.lineId, parsed.iso);
    const rrule = event.rrule ?? (event.frequency ? frequencyToRrule(event.frequency) : undefined);
    const alarms = event.alarms ?? DEFAULT_ALARMS;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    if (rrule) {
      lines.push(`RRULE:${rrule}`);
    }

    for (const trigger of alarms) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(`Reminder: ${event.summary}`)}`);
      lines.push(`TRIGGER:${trigger}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}

/**
 * Trigger a browser download for a UTF-8 `.ics` calendar file.
 */
export function downloadIcs(filename: string, content: string): void {
  const safeFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = safeFilename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
