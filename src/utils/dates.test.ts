import { describe, it, expect, vi } from "vitest";
import {
  parseLocalDate,
  timeAgo,
  isSameDay,
  formatCountdown,
  getCountdownAriaLabel,
  formatRelative,
  formatAbsolute,
} from "./dates";

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as a local calendar date (not UTC midnight)", () => {
    const d = parseLocalDate("2025-03-01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(2); // March (0-indexed)
    expect(d!.getDate()).toBe(1);
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it("handles valid leap day and rejects invalid calendar dates", () => {
    const leap = parseLocalDate("2024-02-29");
    expect(leap).not.toBeNull();
    expect(leap!.getFullYear()).toBe(2024);
    expect(leap!.getMonth()).toBe(1);
    expect(leap!.getDate()).toBe(29);

    expect(parseLocalDate("2025-02-29")).toBeNull();
  });

  it("preserves full ISO timestamps with Z or offset", () => {
    const iso = "2025-03-01T14:30:00Z";
    const d = parseLocalDate(iso);
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBe(Date.parse(iso));
  });

  it("returns null for empty or invalid strings", () => {
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate("not-a-date")).toBeNull();
  });
});

describe("timeAgo", () => {
  const NOW = new Date("2025-01-15T12:00:00Z");

  it("reports very recent times in seconds", () => {
    const tenSecondsAgo = new Date(NOW.getTime() - 10_000);
    expect(timeAgo(tenSecondsAgo, NOW)).toMatch(/second/);
  });

  it("reports minute-level differences in minutes", () => {
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60_000);
    expect(timeAgo(fiveMinutesAgo, NOW)).toMatch(/minute/);
  });

  it("reports day-level differences in days", () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000);
    expect(timeAgo(threeDaysAgo, NOW)).toMatch(/day/);
  });

  it("handles future times", () => {
    const inOneHour = new Date(NOW.getTime() + 60 * 60_000);
    const result = timeAgo(inOneHour, NOW);
    expect(result).toMatch(/hour/);
  });

  it("handles clock skew and zero-second boundaries without -0 or 'in 0 seconds'", () => {
    const slightlyPast = new Date(NOW.getTime() - 200);
    const slightlyFuture = new Date(NOW.getTime() + 200);
    const fiveSecondsFuture = new Date(NOW.getTime() + 5_000);

    expect(timeAgo(NOW, NOW)).toBe("now");
    expect(timeAgo(slightlyPast, NOW)).toBe("now");
    expect(timeAgo(slightlyFuture, NOW)).toBe("now");
    expect(timeAgo(fiveSecondsFuture, NOW)).toBe("in 5 seconds");
  });

  it("handles exact 60 s and 24 h boundaries", () => {
    const sixtySecondsAgo = new Date(NOW.getTime() - 60_000);
    const twentyFourHoursAgo = new Date(NOW.getTime() - 24 * 60 * 60_000);

    expect(timeAgo(sixtySecondsAgo, NOW)).toBe("1 minute ago");
    expect(timeAgo(twentyFourHoursAgo, NOW)).toBe("yesterday");
  });

  it("returns placeholder without throwing for invalid ISO strings", () => {
    expect(() => timeAgo("not-a-date", NOW)).not.toThrow();
    expect(timeAgo("not-a-date", NOW)).toBe("—");
  });

  it("formats relative times in non-English locales (es, de)", () => {
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60_000);
    const oneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60_000);

    expect(timeAgo(fiveMinutesAgo, NOW, "es")).toBe("hace 5 minutos");
    expect(timeAgo(oneDayAgo, NOW, "es")).toBe("ayer");
    expect(timeAgo(fiveMinutesAgo, NOW, "de")).toBe("vor 5 Minuten");
    expect(timeAgo(oneDayAgo, NOW, "de")).toBe("gestern");
  });
});

describe("isSameDay", () => {
  it("returns true for two times on the same calendar day", () => {
    const morning = new Date("2025-01-15T03:00:00");
    const evening = new Date("2025-01-15T22:00:00");
    expect(isSameDay(morning, evening)).toBe(true);
  });

  it("returns false for two times on different calendar days", () => {
    const day1 = new Date("2025-01-15T23:30:00");
    const day2 = new Date("2025-01-16T00:30:00");
    expect(isSameDay(day1, day2)).toBe(false);
  });
});

describe("formatCountdown", () => {
  const NOW = new Date("2025-02-20T12:00:00Z");

  it('returns "now" for past dates', () => {
    expect(formatCountdown("2025-02-19T00:00:00Z", NOW)).toBe("now");
  });

  it("formats minutes only", () => {
    expect(formatCountdown("2025-02-20T12:45:00Z", NOW)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatCountdown("2025-02-20T14:32:00Z", NOW)).toBe("2h 32m");
  });

  it("formats days only", () => {
    expect(formatCountdown("2025-02-23T12:00:00Z", NOW)).toBe("3d");
  });

  it("omits zero-valued units", () => {
    expect(formatCountdown("2025-02-20T13:00:00Z", NOW)).toBe("1h");
  });
});

describe("getCountdownAriaLabel", () => {
  const NOW = new Date("2025-02-20T12:00:00Z");

  it("returns a full sentence for hours and minutes", () => {
    expect(getCountdownAriaLabel("2025-02-20T14:14:00Z", NOW)).toBe(
      "Next interest in 2 hours",
    );
  });

  it("returns a full sentence for minutes", () => {
    expect(getCountdownAriaLabel("2025-02-20T12:14:00Z", NOW)).toBe(
      "Next interest in 14 minutes",
    );
  });

  it("returns a full sentence for days", () => {
    expect(getCountdownAriaLabel("2025-02-23T12:00:00Z", NOW)).toBe(
      "Next interest in 3 days",
    );
  });

  it("handles past dates gracefully", () => {
    expect(getCountdownAriaLabel("2025-02-19T00:00:00Z", NOW)).toBe(
      "Interest is accruing now",
    );
  });
});

// ─── Issue #1189: calendar grouping ────────────────────────────────────────

import {
  getCalendarGroup,
  relativeTime as calendarRelativeTime,
} from "./dates";

describe("getCalendarGroup (#1189)", () => {
  // Row 1: now 00:15, tx yesterday 23:30 → "Yesterday"
  it("row 1: yesterday 23:30 viewed at 00:15 today → Yesterday", () => {
    const now = new Date("2025-06-15T00:15:00");
    const txYesterday = new Date("2025-06-14T23:30:00");
    expect(getCalendarGroup(txYesterday, now)).toBe("Yesterday");
  });

  // Row 2: now 23:50, tx 25h ago (two calendar days back) → not "Yesterday"
  it("row 2: two calendar days back → not Yesterday", () => {
    const now = new Date("2025-06-15T23:50:00");
    const txTwoDaysAgo = new Date("2025-06-13T22:50:00"); // 25h ago, two calendar days
    expect(getCalendarGroup(txTwoDaysAgo, now)).not.toBe("Yesterday");
  });

  // Row 3: tx 2 minutes in the future → "Upcoming"
  it("row 3: future timestamp → Upcoming", () => {
    const now = new Date("2025-06-15T12:00:00");
    const txFuture = new Date("2025-06-15T12:02:00");
    expect(getCalendarGroup(txFuture, now)).toBe("Upcoming");
  });

  // Row 4: week boundary on configured weekStartsOn
  it("row 4: week boundary respects weekStartsOn (Monday)", () => {
    // Sunday 2025-06-15. If weekStartsOn = Monday (1), Sunday is the LAST day of prior week.
    const sunday = new Date("2025-06-15T12:00:00");
    const mondayBefore = new Date("2025-06-09T12:00:00");
    // With weekStartsOn=1, both Sunday and Monday of prior week are "This Week" if within window.
    // Sunday itself should be "Today" (same day).
    expect(getCalendarGroup(sunday, sunday)).toBe("Today");
    // Monday before (6 days ago, current week starts Monday the 9th):
    expect(getCalendarGroup(mondayBefore, sunday, { weekStartsOn: 1 })).toBe(
      "This Week",
    );
  });

  // Row 6: invalid date → "Unknown date", no throw
  it("row 6: invalid date → Unknown date, no throw", () => {
    const now = new Date("2025-06-15T12:00:00");
    expect(() => getCalendarGroup("not-a-date", now)).not.toThrow();
    expect(getCalendarGroup("not-a-date", now)).toBe("Unknown date");
  });
});

describe("relativeTime (#1189)", () => {
  it('row 3: future timestamp → "in Nm"', () => {
    const now = new Date("2025-06-15T12:00:00");
    const future = new Date("2025-06-15T12:02:00");
    expect(calendarRelativeTime(future, now)).toBe("in 2m");
  });

  it('under 1 minute → "just now"', () => {
    const now = new Date("2025-06-15T12:00:00");
    const justNow = new Date("2025-06-15T11:59:30");
    expect(calendarRelativeTime(justNow, now)).toBe("just now");
  });

  it('45 minutes ago → "45m ago"', () => {
    const now = new Date("2025-06-15T00:15:00");
    const tx = new Date("2025-06-14T23:30:00");
    expect(calendarRelativeTime(tx, now)).toBe("45m ago");
  });
});

describe("locale and invalid-date fallbacks", () => {
  const NOW = new Date("2025-02-20T12:00:00Z");
  const FIVE_MIN_AGO = new Date(NOW.getTime() - 5 * 60_000);
  const THREE_DAYS_AGO = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000);
  const TWO_HOURS_LATER = new Date(NOW.getTime() + 2 * 60 * 60_000);
  const INVALID_DATE = new Date("not-a-valid-date");

  it("never throws or logs on invalid locales across all locale-aware helpers", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const badLocales: unknown[] = [
      "xx-INVALID",
      "",
      "en_US",
      null,
      undefined,
    ];

    try {
      for (const locale of badLocales) {
        const loc = locale as string;
        expect(() => timeAgo(FIVE_MIN_AGO, NOW, loc)).not.toThrow();
        expect(timeAgo(FIVE_MIN_AGO, NOW, loc)).toMatch(/minute/);

        expect(() =>
          getCountdownAriaLabel(TWO_HOURS_LATER, NOW, loc),
        ).not.toThrow();
        expect(getCountdownAriaLabel(TWO_HOURS_LATER, NOW, loc)).toBe(
          "Next interest in 2 hours",
        );

        expect(() => formatRelative(FIVE_MIN_AGO, NOW, loc)).not.toThrow();
        expect(formatRelative(FIVE_MIN_AGO, NOW, loc)).toMatch(/minute/);

        expect(() => formatRelative(THREE_DAYS_AGO, NOW, loc)).not.toThrow();
        expect(formatRelative(THREE_DAYS_AGO, NOW, loc)).toMatch(/Feb/);

        expect(() => formatAbsolute(NOW, loc)).not.toThrow();
        expect(formatAbsolute(NOW, loc)).toMatch(/2025/);
      }

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("returns placeholder for invalid dates without throwing", () => {
    expect(timeAgo(INVALID_DATE, NOW)).toBe("—");
    expect(timeAgo("not-a-date", NOW)).toBe("—");
    expect(formatCountdown(INVALID_DATE, NOW)).toBe("—");
    expect(getCountdownAriaLabel(INVALID_DATE, NOW)).toBe("—");
    expect(formatRelative(INVALID_DATE, NOW)).toBe("—");
    expect(formatAbsolute(INVALID_DATE)).toBe("—");
  });
});
