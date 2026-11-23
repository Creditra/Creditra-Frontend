import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildIcs,
  buildEventUid,
  downloadIcs,
  escapeIcsText,
  foldIcsLine,
  formatIcsTimestamp,
  frequencyToRrule,
  DEFAULT_PROD_ID,
} from './ics';
import type { AutopayFrequency } from '../lib/autopay-schedule';

const encoder = new TextEncoder();

describe('escapeIcsText', () => {
  it('escapes backslashes, semicolons, commas, and newlines', () => {
    expect(escapeIcsText('Line A, B; C\\D\nNext\r\nEnd')).toBe(
      'Line A\\, B\\; C\\\\D\\nNext\\nEnd',
    );
  });
});

describe('foldIcsLine', () => {
  it('leaves lines <= 75 octets unchanged', () => {
    const line = 'SUMMARY:' + 'a'.repeat(67);
    expect(encoder.encode(line).length).toBe(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it('folds long ASCII lines at 75 octets with CRLF + leading space', () => {
    const line = 'DESCRIPTION:' + 'x'.repeat(160);
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(2);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    // Unfolding (removing CRLF + single space) restores exact original line
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('never splits multi-byte UTF-8 characters across fold boundaries', () => {
    // 4-byte emoji + 3-byte CJK + 2-byte accented characters
    const line = 'SUMMARY:' + '💳Créditra返済予定'.repeat(10);
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
      // No Unicode replacement characters (U+FFFD) from broken surrogate/byte splits
      expect(part).not.toContain('\uFFFD');
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('frequencyToRrule', () => {
  it.each<[AutopayFrequency, string]>([
    ['weekly', 'FREQ=WEEKLY'],
    ['biweekly', 'FREQ=WEEKLY;INTERVAL=2'],
    ['monthly', 'FREQ=MONTHLY'],
    ['quarterly', 'FREQ=MONTHLY;INTERVAL=3'],
  ])('maps %s to %s', (frequency, expected) => {
    expect(frequencyToRrule(frequency)).toBe(expected);
  });
});

describe('buildEventUid', () => {
  it('produces deterministic UIDs in ${lineId}-${date}@creditra format', () => {
    const uid1 = buildEventUid('line-42', '2026-08-15');
    const uid2 = buildEventUid('line-42', '2026-08-15T10:30:00Z');
    expect(uid1).toBe('line-42-2026-08-15@creditra');
    expect(uid2).toBe(uid1);
  });
});

describe('formatIcsTimestamp', () => {
  it('formats a Date as UTC YYYYMMDDTHHMMSSZ', () => {
    expect(formatIcsTimestamp(new Date('2026-08-01T09:05:07Z'))).toBe(
      '20260801T090507Z',
    );
  });
});

describe('buildIcs', () => {
  const fixedNow = new Date('2026-07-01T12:00:00Z');

  it('generates valid RFC 5545 output with CRLF, all-day VALUE=DATE, DTSTAMP, and VALARM', () => {
    const ics = buildIcs(
      [
        {
          lineId: 'biz-1',
          date: '2026-12-31',
          summary: 'Working Capital, Q4; Payment',
          description: 'Principal: $1,000\nInterest: $200',
        },
      ],
      { now: fixedNow },
    );

    // Only CRLF line endings (no bare LF)
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain(`PRODID:${DEFAULT_PROD_ID}\r\n`);
    expect(ics).toContain('UID:biz-1-2026-12-31@creditra\r\n');
    expect(ics).toContain('DTSTAMP:20260701T120000Z\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    // Exclusive next-day DTEND rolls over year boundary
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('SUMMARY:Working Capital\\, Q4\\; Payment\r\n');
    expect(ics).toContain('DESCRIPTION:Principal: $1\\,000\\nInterest: $200\r\n');
    expect(ics).toContain('TRIGGER:-P1D\r\n');
    expect(ics).toContain('TRIGGER:-PT9H\r\n');
    expect(ics).toContain('END:VCALENDAR\r\n');
  });

  it('includes RRULE when frequency or rrule is provided', () => {
    const ics = buildIcs(
      [
        {
          lineId: 'autopay-1',
          date: '2026-08-01',
          summary: 'Autopay',
          frequency: 'biweekly',
        },
      ],
      { now: fixedNow, prodId: '-//Custom//Prod//EN' },
    );

    expect(ics).toContain('PRODID:-//Custom//Prod//EN\r\n');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2\r\n');
  });

  it('re-exporting the same event produces the exact same UID', () => {
    const event = {
      lineId: 'line-99',
      date: '2026-09-15',
      summary: 'Monthly Payment',
    };
    const first = buildIcs([event], { now: new Date('2026-07-01T00:00:00Z') });
    const second = buildIcs([event], { now: new Date('2026-08-01T00:00:00Z') });

    const uidMatch1 = /^UID:(.+)$/m.exec(first)?.[1].trim();
    const uidMatch2 = /^UID:(.+)$/m.exec(second)?.[1].trim();
    expect(uidMatch1).toBe('line-99-2026-09-15@creditra');
    expect(uidMatch2).toBe(uidMatch1);
  });

  it('skips events with invalid dates safely', () => {
    const ics = buildIcs(
      [{ lineId: 'bad', date: 'TBD', summary: 'Invalid' }],
      { now: fixedNow },
    );
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});

describe('downloadIcs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a text/calendar Blob, triggers anchor download, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-ics-url');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    downloadIcs('repayments', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/calendar;charset=utf-8');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-ics-url');
  });
});
