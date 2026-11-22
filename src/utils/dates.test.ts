import { describe, it, expect } from "vitest";
import {
  timeAgo,
  isSameDay,
  formatCountdown,
  getCountdownAriaLabel,
} from "./dates";

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
