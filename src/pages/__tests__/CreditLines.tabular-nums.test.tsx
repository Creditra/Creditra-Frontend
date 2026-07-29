/**
 * @fileoverview Tabular-nums tests for CreditLines page — issue #573
 *
 * GrantFox FWC26 (Stellar Wave) — Tabular-nums requirement
 * "Apply font-variant-numeric: tabular-nums to numeric displays on CreditLines."
 *
 * Coverage:
 *  1. CSS file structure — verifies .tabular-nums and .num-tabular are
 *     declared correctly in typography.css.
 *  2. CreditLines page — metric values (Limit, Utilized, Available),
 *     utilization percentage, APR, Risk Score detail cells, and the
 *     RepaymentSchedule summary strip all carry the tabular-nums class.
 *  3. RepaymentSchedule integration — amount, split-value cells inside the
 *     timeline entries carry tabular-nums.
 *
 * Note: jsdom does not compute external stylesheets, so tests assert at the
 * class/attribute level rather than on computed style. Browser-level
 * verification is covered by the visual regression suite.
 */

import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import CreditLines from '../CreditLines';
import { RepaymentSchedule } from '../../components/RepaymentSchedule';
import type { ScheduledRepayment } from '../../components/RepaymentSchedule';

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Render CreditLines past the 500 ms loading skeleton so tests see real
 * content, not skeleton placeholders.
 */
function renderPage() {
  const result = render(
    <BrowserRouter>
      <CreditLines defaultLoading={false} />
    </BrowserRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(600);
  });
  return result;
}

// ─── 1. CSS file structure ────────────────────────────────────────────────────

describe('typography.css — tabular-nums classes (issue #573)', () => {
  const cssPath = resolve(__dirname, '../../styles/typography.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('declares font-variant-numeric: tabular-nums', () => {
    expect(css).toContain('font-variant-numeric: tabular-nums');
  });

  it('defines the .num-tabular class', () => {
    expect(css).toMatch(/\.num-tabular/);
  });

  it('defines the .tabular-nums alias class', () => {
    expect(css).toMatch(/\.tabular-nums/);
  });

  it('.num-tabular and .tabular-nums share the same declaration block', () => {
    expect(css).toMatch(
      /\.num-tabular[\s\S]*?\.tabular-nums[\s\S]*?font-variant-numeric:\s*tabular-nums/,
    );
  });

  it('includes font-feature-settings "tnum" 1 for OpenType tnum activation', () => {
    expect(css).toMatch(/font-feature-settings:\s*["']tnum["']\s*1/);
  });

  it('defines .num-display for hero/display values', () => {
    expect(css).toMatch(/\.num-display/);
  });

  it('defines .num-mono for monospace numeric strings', () => {
    expect(css).toMatch(/\.num-mono/);
  });
});

// ─── 2. CreditLines page ─────────────────────────────────────────────────────

describe('CreditLines — tabular-nums on numeric displays (issue #573)', () => {
  it('Limit metric value carries tabular-nums class', () => {
    const { container } = renderPage();
    // Each card has 3 .cl-metric elements: Limit, Utilized, Available
    const metricValues = container.querySelectorAll('.cl-metric-value');
    expect(metricValues.length).toBeGreaterThanOrEqual(3);
    metricValues.forEach((el) => {
      expect(el.classList.contains('tabular-nums')).toBe(true);
    });
  });

  it('utilization percentage span carries tabular-nums class', () => {
    const { container } = renderPage();
    // Each card has a .cl-util-header with a percentage span
    const utilHeaders = container.querySelectorAll('.cl-util-header');
    expect(utilHeaders.length).toBeGreaterThanOrEqual(1);
    utilHeaders.forEach((header) => {
      // The percentage is the second child of cl-util-header
      const pctSpan = header.querySelector('.tabular-nums');
      expect(pctSpan).toBeTruthy();
    });
  });

  it('APR detail value carries tabular-nums class', () => {
    const { container } = renderPage();
    // cl-details contains three .cl-detail elements per card; APR is first
    const details = container.querySelectorAll('.cl-detail');
    expect(details.length).toBeGreaterThanOrEqual(3);
    // APR and Risk Score .value elements should have tabular-nums
    const numericValues = container.querySelectorAll('.cl-detail .value.tabular-nums');
    // At minimum APR + Risk Score per card (2 per card × at least 1 card)
    expect(numericValues.length).toBeGreaterThanOrEqual(2);
  });

  it('Risk Score detail value carries tabular-nums class', () => {
    const { container } = renderPage();
    // Find a card's detail section and check Risk Score cell
    const firstCard = container.querySelector('.cl-card');
    expect(firstCard).not.toBeNull();
    const riskScoreDetail = Array.from(
      (firstCard as HTMLElement).querySelectorAll('.cl-detail'),
    ).find((d) => d.querySelector('.label')?.textContent?.includes('Risk Score'));
    expect(riskScoreDetail).toBeDefined();
    const valueSpan = riskScoreDetail?.querySelector('.value');
    expect(valueSpan?.classList.contains('tabular-nums')).toBe(true);
  });

  it('every cl-metric-value in every card has tabular-nums', () => {
    const { container } = renderPage();
    const allMetricValues = container.querySelectorAll('.cl-metric-value');
    expect(allMetricValues.length).toBeGreaterThanOrEqual(3);
    allMetricValues.forEach((el) => {
      expect(
        el.classList.contains('tabular-nums'),
        `Expected .cl-metric-value to have tabular-nums; got "${el.className}"`,
      ).toBe(true);
    });
  });

  it('page renders at least one tabular-nums element after loading', () => {
    const { container } = renderPage();
    const tabularEls = container.querySelectorAll('.tabular-nums');
    expect(tabularEls.length).toBeGreaterThan(0);
  });
});

// ─── 3. RepaymentSchedule integration ────────────────────────────────────────

describe('RepaymentSchedule — tabular-nums on amount cells (issue #573)', () => {
  /** Minimal fixture that exercises all cell types. */
  const SCHEDULE: ScheduledRepayment[] = [
    {
      id: 'paid-CL-001-2024-01-15',
      dueDate: '2024-01-15',
      paidDate: '2024-01-15',
      amount: 1250.75,
      principal: 750,
      interest: 500.75,
      status: 'paid',
      lineName: 'Primary Business Line',
    },
    {
      id: 'next-CL-001',
      dueDate: '2025-02-15',
      amount: 1300,
      principal: 780,
      interest: 520,
      status: 'upcoming',
      lineName: 'Primary Business Line',
      note: 'Next scheduled payment',
    },
    {
      id: 'future-CL-001-0',
      dueDate: '2025-03-15',
      amount: 1300,
      principal: 845,
      interest: 455,
      status: 'scheduled',
      lineName: 'Primary Business Line',
    },
  ];

  function renderSchedule() {
    return render(
      <BrowserRouter>
        <RepaymentSchedule
          schedule={SCHEDULE}
          title="Test Schedule"
          now={new Date('2025-02-10')}
        />
      </BrowserRouter>,
    );
  }

  it('summary strip "Paid to date" value carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const paidValue = container.querySelector(
      '.rs-schedule__summary-value--paid.tabular-nums',
    );
    expect(paidValue).toBeTruthy();
  });

  it('summary strip "Remaining" value carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const summaryValues = container.querySelectorAll('.rs-schedule__summary-value.tabular-nums');
    expect(summaryValues.length).toBeGreaterThanOrEqual(2);
  });

  it('summary strip count values (Upcoming, Overdue) carry tabular-nums class', () => {
    const { container } = renderSchedule();
    const summaryValues = container.querySelectorAll('.rs-schedule__summary-value.tabular-nums');
    // All 4 summary cells should carry tabular-nums
    expect(summaryValues.length).toBe(4);
  });

  it('timeline entry total amount carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const amounts = container.querySelectorAll('.rs-schedule__amount.tabular-nums');
    expect(amounts.length).toBeGreaterThanOrEqual(SCHEDULE.length);
  });

  it('timeline entry principal split-value carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const splitValues = container.querySelectorAll('.rs-schedule__split-value.tabular-nums');
    // 2 per entry (principal + interest) × number of entries
    expect(splitValues.length).toBe(SCHEDULE.length * 2);
  });

  it('timeline entry interest split-value carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const splitValues = container.querySelectorAll('.rs-schedule__split-value.tabular-nums');
    expect(splitValues.length).toBeGreaterThanOrEqual(2);
  });

  it('total-count badge carries tabular-nums class', () => {
    const { container } = renderSchedule();
    const totalCount = container.querySelector('.rs-schedule__total-count.tabular-nums');
    expect(totalCount).toBeTruthy();
    expect(totalCount?.textContent).toContain('3');
  });

  it('all rs-schedule__amount elements carry tabular-nums', () => {
    const { container } = renderSchedule();
    const amounts = container.querySelectorAll('.rs-schedule__amount');
    amounts.forEach((el) => {
      expect(el.classList.contains('tabular-nums')).toBe(true);
    });
  });

  it('all rs-schedule__split-value elements carry tabular-nums', () => {
    const { container } = renderSchedule();
    const splitValues = container.querySelectorAll('.rs-schedule__split-value');
    splitValues.forEach((el) => {
      expect(el.classList.contains('tabular-nums')).toBe(true);
    });
  });

  it('renders with an empty schedule without crashing', () => {
    expect(() =>
      render(
        <BrowserRouter>
          <RepaymentSchedule schedule={[]} title="Empty" />
        </BrowserRouter>,
      ),
    ).not.toThrow();
  });
});
