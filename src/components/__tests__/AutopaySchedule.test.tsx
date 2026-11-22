import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutopaySchedule } from '../AutopaySchedule';
import {
  addMonthsClamped,
  buildSchedule,
  type AutopayFrequency,
} from '../../lib/autopay-schedule';

const parts = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

const scheduleParts = (
  startDate: string,
  frequency: AutopayFrequency,
  endDate?: string,
  maxRows = 8,
) => buildSchedule(startDate, frequency, endDate, maxRows).map(parts);

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

describe('buildSchedule — month-end clamping', () => {
  it('clamps a Jan 31 monthly start to Feb 29 in a leap year and returns to Mar 31', () => {
    expect(scheduleParts('2024-01-31', 'monthly', undefined, 5)).toEqual([
      [2024, 1, 31],
      [2024, 2, 29],
      [2024, 3, 31],
      [2024, 4, 30],
      [2024, 5, 31],
    ]);
  });

  it('clamps a Jan 31 monthly start to Feb 28 in a non-leap year', () => {
    expect(scheduleParts('2023-01-31', 'monthly', undefined, 3)).toEqual([
      [2023, 1, 31],
      [2023, 2, 28],
      [2023, 3, 31],
    ]);
  });

  it('clamps a Jan 31 start in a century non-leap year (2100)', () => {
    expect(scheduleParts('2100-01-31', 'monthly', undefined, 3)).toEqual([
      [2100, 1, 31],
      [2100, 2, 28],
      [2100, 3, 31],
    ]);
  });

  it('clamps an Aug 31 quarterly start without drifting', () => {
    expect(scheduleParts('2024-08-31', 'quarterly', undefined, 4)).toEqual([
      [2024, 8, 31],
      [2024, 11, 30],
      [2025, 2, 28],
      [2025, 5, 31],
    ]);
  });

  it('clamps a leap-day start and yearly 12-month steps', () => {
    expect(scheduleParts('2024-02-29', 'monthly', undefined, 3)).toEqual([
      [2024, 2, 29],
      [2024, 3, 29],
      [2024, 4, 29],
    ]);

    expect(parts(addMonthsClamped(new Date(2024, 1, 29), 12))).toEqual([2025, 2, 28]);
    expect(parts(addMonthsClamped(new Date(2028, 1, 29), 12))).toEqual([2029, 2, 28]);
    expect(parts(addMonthsClamped(new Date(2024, 1, 29), 48))).toEqual([2028, 2, 29]);
  });

  it('leaves weekly and biweekly schedules unaffected by month lengths', () => {
    expect(scheduleParts('2024-03-01', 'weekly', undefined, 3)).toEqual([
      [2024, 3, 1],
      [2024, 3, 8],
      [2024, 3, 15],
    ]);
    expect(scheduleParts('2024-03-01', 'biweekly', undefined, 3)).toEqual([
      [2024, 3, 1],
      [2024, 3, 15],
      [2024, 3, 29],
    ]);
  });
});

describe('buildSchedule — ordering and limits', () => {
  const frequencies: AutopayFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];

  it.each(frequencies)('returns strictly ascending dates with no duplicates for %s', (frequency) => {
    const dates = buildSchedule('2024-01-31', frequency, undefined, 12);
    const keys = dates.map(dateKey);

    expect(new Set(keys).size).toBe(keys.length);
    for (let index = 1; index < dates.length; index++) {
      expect(dates[index].getTime()).toBeGreaterThan(dates[index - 1].getTime());
    }
  });

  it('includes the end date when it falls on an occurrence', () => {
    expect(scheduleParts('2024-01-31', 'monthly', '2024-03-31', 12)).toEqual([
      [2024, 1, 31],
      [2024, 2, 29],
      [2024, 3, 31],
    ]);
  });

  it('includes an end date that is a clamped occurrence', () => {
    expect(scheduleParts('2024-01-31', 'monthly', '2024-02-29', 12)).toEqual([
      [2024, 1, 31],
      [2024, 2, 29],
    ]);
  });

  it('stops before the first occurrence after the end date', () => {
    expect(scheduleParts('2024-01-31', 'monthly', '2024-03-30', 12)).toEqual([
      [2024, 1, 31],
      [2024, 2, 29],
    ]);
  });

  it('respects the maxRows cap', () => {
    expect(buildSchedule('2024-01-31', 'monthly', undefined, 3)).toHaveLength(3);
  });

  it('returns an empty list for an invalid start date', () => {
    expect(buildSchedule('not-a-date', 'monthly')).toEqual([]);
  });

  it('returns an empty list for a non-positive maxRows', () => {
    expect(buildSchedule('2024-01-31', 'monthly', undefined, 0)).toEqual([]);
  });
});

describe('AutopaySchedule — rendered rows', () => {
  it('renders the clamped dates in ascending order with no shared dates', () => {
    const { container } = render(
      <AutopaySchedule amount={100} frequency="monthly" startDate="2024-01-31" maxRows={4} />,
    );

    const rendered = Array.from(container.querySelectorAll('time')).map((element) =>
      element.getAttribute('datetime'),
    );

    expect(rendered).toEqual(['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']);
    expect(new Set(rendered).size).toBe(rendered.length);
    for (let index = 1; index < rendered.length; index++) {
      expect((rendered[index] ?? '') > (rendered[index - 1] ?? '')).toBe(true);
    }
  });

  it('renders the selected credit line name and repayable balance', () => {
    render(
      <AutopaySchedule
        amount={100}
        frequency="monthly"
        startDate="2024-01-31"
        maxRows={2}
        creditLineName="Primary Business Line"
        creditLineBalance={1234}
      />,
    );

    expect(screen.getByText(/Primary Business Line/)).toBeInTheDocument();
    expect(screen.getByText(/1,234 repayable/)).toBeInTheDocument();
  });
});
