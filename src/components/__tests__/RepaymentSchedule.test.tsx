import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import {
  RepaymentSchedule,
  buildRepaymentScheduleFromLine,
  buildRepaymentScheduleFromLines,
  deriveStatus,
  type ScheduledRepayment,
} from '../RepaymentSchedule';
import type { CreditLine } from '../../types/creditLine';
import * as icsUtils from '../../utils/ics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A frozen "now" so date-based assertions are deterministic. */
const FROZEN_NOW = new Date('2025-03-15T12:00:00Z');

/** Minimal schedule fixture covering every status. */
const MIXED_SCHEDULE: ScheduledRepayment[] = [
  {
    id: 'paid-1',
    dueDate: '2025-02-10',
    paidDate: '2025-02-10T14:15:00Z',
    amount: 1500,
    principal: 1200,
    interest: 300,
    status: 'paid',
    note: 'Monthly repayment',
    lineName: 'Primary Business Line',
    txHash: '0xabc123',
  },
  {
    id: 'paid-2',
    dueDate: '2025-01-12',
    paidDate: '2025-01-13T09:00:00Z',
    amount: 1500,
    principal: 1250,
    interest: 250,
    status: 'paid',
    note: 'Monthly repayment',
    lineName: 'Primary Business Line',
    txHash: '0xdef456',
  },
  {
    id: 'upcoming-1',
    dueDate: '2025-03-20',
    amount: 3200,
    principal: 2000,
    interest: 1200,
    status: 'upcoming',
    lineName: 'Primary Business Line',
  },
  {
    id: 'scheduled-1',
    dueDate: '2025-04-20',
    amount: 3200,
    principal: 2100,
    interest: 1100,
    status: 'scheduled',
    lineName: 'Primary Business Line',
  },
  {
    id: 'scheduled-2',
    dueDate: '2025-05-20',
    amount: 3200,
    principal: 2200,
    interest: 1000,
    status: 'scheduled',
    lineName: 'Primary Business Line',
  },
  {
    id: 'overdue-1',
    dueDate: '2025-03-01',
    amount: 5100,
    principal: 3000,
    interest: 2100,
    status: 'overdue',
    lineName: 'Expansion Capital Line',
    note: 'Missed payment',
  },
];

// ─── Component rendering ────────────────────────────────────────────────────

describe('RepaymentSchedule', () => {
  it('renders all installments in chronological order', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    const list = screen.getByRole('list', {
      name: /repayment installments in chronological order/i,
    });
    const dates = within(list)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('time')?.getAttribute('datetime'));
    expect(dates).toEqual([
      '2025-01-12',
      '2025-02-10',
      '2025-03-01',
      '2025-03-20',
      '2025-04-20',
      '2025-05-20',
    ]);
  });

  it('renders the title and the installment count badge', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} title="My Schedule" />);
    expect(screen.getByRole('heading', { name: 'My Schedule' })).toBeInTheDocument();
    expect(
      screen.getByLabelText('6 scheduled installments'),
    ).toBeInTheDocument();
  });

  it('uses the singular label when only one installment is present', () => {
    render(
      <RepaymentSchedule
        schedule={[MIXED_SCHEDULE[0]]}
        title="Single"
      />,
    );
    expect(screen.getByLabelText('1 scheduled installment')).toBeInTheDocument();
  });

  it('displays the empty state with a screen-reader-friendly message', () => {
    render(<RepaymentSchedule schedule={[]} />);
    const live = screen.getByRole('status');
    expect(live.textContent).toMatch(/no scheduled repayments/i);
  });

  it('displays the loading skeleton and aria-busy region', () => {
    const { container } = render(
      <RepaymentSchedule schedule={MIXED_SCHEDULE} loading />,
    );
    const region = screen.getByRole('region', { busy: true });
    expect(region).toBeInTheDocument();
    // The skeleton rows are aria-hidden so screen readers won't read them
    // out (the live region announces the loading state instead), so query
    // them directly via the DOM rather than via role-based helpers.
    const skeletons = container.querySelectorAll(
      '.rs-schedule__item--skeleton',
    );
    expect(skeletons).toHaveLength(3);
  });

  it('renders status badges with both icon glyph and text label (not color-only)', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    // Multiple paid entries each expose the same aria-label — use
    // getAllByLabelText and assert the count instead.
    expect(screen.getAllByLabelText('Status: Paid').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Status: Due soon')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Status: Scheduled').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Status: Overdue')).toBeInTheDocument();
    // The badge text is rendered inside the badge span.
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
    // Every status badge also carries a unique icon glyph (WCAG 1.4.1).
    // Both the badge and the legend render the glyph, so use getAllByText.
    expect(screen.getAllByText('\u2713').length).toBeGreaterThanOrEqual(2); // ✓
    expect(screen.getAllByText('\u25CF').length).toBeGreaterThanOrEqual(1); // ●
  });

  it('emits ISO 8601 timestamps via dateTime so screen readers can parse them', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    const times = screen.getAllByRole('listitem')[0].querySelectorAll('time');
    // First installed on 2025-01-12 — both dueDate and paidDate are exposed.
    expect(times[0].getAttribute('datetime')).toBe('2025-01-12');
    if (times.length > 1) {
      expect(times[1].getAttribute('datetime')).toBe('2025-01-13T09:00:00Z');
    }
  });

  it('renders the principal / interest split with aria-labels', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    expect(
      screen.getAllByLabelText(/Principal \$1,200 and interest \$300/).length,
    ).toBeGreaterThan(0);
  });

  it('exposes the on-chain tx hash for paid installments', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    expect(
      screen.getByLabelText('On-chain transaction 0xabc123'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('On-chain transaction 0xdef456'),
    ).toBeInTheDocument();
  });


  it('shows aggregate summary stats including alert state when overdue > 0', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    // Scope to the summary so we don't accidentally match amount rows
    // in the timeline below (e.g. installment principal splits).
    const summary = screen.getByRole('status');
    // Paid total = 1500 + 1500 = $3,000
    expect(within(summary).getByText('$3,000')).toBeInTheDocument();
    // Remaining = 3200 + 3200 + 3200 + 5100 = $14,700
    expect(within(summary).getByText('$14,700')).toBeInTheDocument();
    // Upcoming count = 3 (one upcoming + two scheduled)
    expect(within(summary).getByText('3')).toBeInTheDocument();
    // Overdue count = 1
    expect(within(summary).getByText('1')).toBeInTheDocument();
  });

  it('marks today with the "Today" pill when an installment is due today', () => {
    const todayEntry: ScheduledRepayment = {
      id: 'today-1',
      // Anchor the dueDate to FROZEN_NOW's UTC date so the comparison is
      // timezone-stable across CI / local environments.
      dueDate: FROZEN_NOW.toISOString().split('T')[0],
      amount: 3200,
      principal: 2000,
      interest: 1200,
      status: 'upcoming',
      lineName: 'Primary Business Line',
    };
    render(<RepaymentSchedule schedule={[todayEntry]} now={FROZEN_NOW} />);
    expect(screen.getByText(/Today/)).toBeInTheDocument();
  });

  it('uses no inline hex colors (design tokens only)', () => {
    const { container } = render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    // No style attribute on the rendered tree should contain a hex value;
    // all theming flows through CSS custom properties in index.css.
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach((el) => {
      const styleAttr = el.getAttribute('style') ?? '';
      expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    });
  });

  it('provides a keyboard-focusable scrollable list region', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} />);
    const list = screen.getByRole('list');
    expect(list.getAttribute('tabindex')).toBe('0');
  });

  it('uses an accessible region landmark wrapping the schedule', () => {
    render(<RepaymentSchedule schedule={MIXED_SCHEDULE} now={FROZEN_NOW} title="My Schedule" />);
    expect(
      screen.getByRole('region', { name: 'My Schedule' }),
    ).toBeInTheDocument();
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  const cases: Array<{
    days: number;
    expected: ScheduledRepayment['status'];
  }> = [
    { days: 0, expected: 'upcoming' },
    { days: 7, expected: 'upcoming' },
    { days: 8, expected: 'scheduled' },
    { days: 30, expected: 'scheduled' },
    { days: -1, expected: 'overdue' },
    { days: -90, expected: 'overdue' },
    { days: -91, expected: 'defaulted' },
    { days: -365, expected: 'defaulted' },
  ];

  cases.forEach(({ days, expected }) => {
    it(`returns ${expected} when due date is ${days} day(s) from today`, () => {
      const now = new Date('2025-03-15T12:00:00Z');
      const due = new Date(now);
      due.setDate(due.getDate() + days);
      expect(deriveStatus(due.toISOString(), now)).toBe(expected);
    });
  });
});

describe('buildRepaymentScheduleFromLine', () => {
  const baseLine: CreditLine = {
    id: 'TEST-001',
    name: 'Test Line',
    status: 'Active',
    limit: 500_000,
    utilized: 200_000,
    apr: 8.5,
    riskScore: 720,
    openedAt: '2024-01-01',
    updatedAt: '2025-03-10T12:00:00Z',
    nextPaymentDate: '2025-03-20',
    nextPaymentAmount: 3200,
    transactions: [
      {
        id: 'TX-001',
        type: 'Repay',
        amount: 1500,
        date: '2025-02-10T14:15:00Z',
        note: 'Monthly repayment',
        status: 'Completed',
        txHash: '0xabc',
      },
      {
        id: 'TX-002',
        type: 'Interest',
        amount: 300,
        date: '2025-02-10T23:59:00Z',
        note: 'Interest accrual',
        status: 'Completed',
      },
      {
        id: 'TX-003',
        type: 'Draw',
        amount: 50_000,
        date: '2025-01-22T09:45:00Z',
        status: 'Completed',
      },
      {
        id: 'TX-004',
        type: 'Repay',
        amount: 1500,
        date: '2025-01-12T09:00:00Z',
        status: 'Completed',
      },
    ],
    statusHistory: [],
  };

  it('coalesces Repay + Interest on the same day into a single paid entry', () => {
    const schedule = buildRepaymentScheduleFromLine(baseLine, FROZEN_NOW);
    const paidForFeb10 = schedule.find(
      (s) => s.dueDate === '2025-02-10' && s.status === 'paid',
    );
    expect(paidForFeb10).toBeDefined();
    if (paidForFeb10 && paidForFeb10.status === 'paid') {
      expect(paidForFeb10.amount).toBe(1800);
      expect(paidForFeb10.principal).toBe(1500);
      expect(paidForFeb10.interest).toBe(300);
    }
  });

  it('classifies the next payment as upcoming when within 7 days', () => {
    const schedule = buildRepaymentScheduleFromLine(baseLine, FROZEN_NOW);
    const upcoming = schedule.find((s) => s.dueDate === '2025-03-20');
    expect(upcoming?.status).toBe('upcoming');
  });

  it('classifies a past next-payment date as overdue', () => {
    const overdueLine = {
      ...baseLine,
      nextPaymentDate: '2025-03-05', // 10 days in the past relative to FROZEN_NOW
    } as CreditLine;
    const schedule = buildRepaymentScheduleFromLine(
      overdueLine,
      FROZEN_NOW,
    );
    const overdue = schedule.find((s) => s.dueDate === '2025-03-05');
    expect(overdue?.status).toBe('overdue');
  });

  it('classifies a long-overdue next-payment date (90+ days) as defaulted', () => {
    const defaultedLine = {
      ...baseLine,
      nextPaymentDate: '2024-11-01',
    } as CreditLine;
    const schedule = buildRepaymentScheduleFromLine(
      defaultedLine,
      FROZEN_NOW,
    );
    const def = schedule.find((s) => s.dueDate === '2024-11-01');
    expect(def?.status).toBe('defaulted');
  });

  it('returns entries sorted ascending by dueDate', () => {
    const schedule = buildRepaymentScheduleFromLine(baseLine, FROZEN_NOW);
    const dates = schedule.map((s) => new Date(s.dueDate).getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  it('synthesizes the requested number of forward-looking installments', () => {
    const schedule = buildRepaymentScheduleFromLine(baseLine, FROZEN_NOW, 3);
    const future = schedule.filter((s) => s.status === 'scheduled');
    expect(future.length).toBe(3);
  });

  it('omits installment synthesis when there is no upcoming amount', () => {
    const nolLine = {
      ...baseLine,
      nextPaymentAmount: undefined,
      nextPaymentDate: undefined,
    } as CreditLine;
    const schedule = buildRepaymentScheduleFromLine(nolLine, FROZEN_NOW, 3);
    const future = schedule.filter((s) => s.status === 'scheduled');
    expect(future.length).toBe(0);
  });

  it('exposes id on every entry so React keys are stable', () => {
    const schedule = buildRepaymentScheduleFromLine(baseLine, FROZEN_NOW);
    schedule.forEach((s) => expect(typeof s.id).toBe('string'));
    // No duplicate ids.
    const ids = schedule.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildRepaymentScheduleFromLines', () => {
  it('merges schedules across lines and sorts chronologically', () => {
    const a: CreditLine = {
      id: 'A',
      name: 'Line A',
      status: 'Active',
      limit: 100_000,
      utilized: 50_000,
      apr: 8,
      riskScore: 700,
      openedAt: '2024-01-01',
      updatedAt: '2025-03-01',
      nextPaymentDate: '2025-04-01',
      nextPaymentAmount: 1000,
      transactions: [],
      statusHistory: [],
    };
    const b: CreditLine = {
      ...a,
      id: 'B',
      name: 'Line B',
      nextPaymentDate: '2025-03-20',
      nextPaymentAmount: 2000,
    };
    const merged = buildRepaymentScheduleFromLines([a, b], FROZEN_NOW);
    const dates = merged.map((s) => new Date(s.dueDate).getTime());
    expect(dates).toEqual([...dates].sort((x, y) => x - y));
    expect(merged.some((s) => s.lineName === 'Line A')).toBe(true);
    expect(merged.some((s) => s.lineName === 'Line B')).toBe(true);
  });

  it('returns an empty array when no lines are passed', () => {
    expect(buildRepaymentScheduleFromLines([], FROZEN_NOW)).toEqual([]);
  });
});

describe('RepaymentSchedule — Add to calendar (.ics export)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports unpaid installments and recurring autopay schedules and announces download', () => {
    const downloadSpy = vi
      .spyOn(icsUtils, 'downloadIcs')
      .mockImplementation(() => {});

    render(
      <RepaymentSchedule
        schedule={MIXED_SCHEDULE}
        now={FROZEN_NOW}
        autopaySchedules={[
          {
            lineId: 'line-ap',
            lineName: 'Autopay Working Capital',
            startDate: '2025-04-01',
            amount: 1000,
            frequency: 'monthly',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [filename, content] = downloadSpy.mock.calls[0];
    expect(filename).toBe('creditra-repayment-schedule.ics');
    // Unpaid installments are included; paid installments are excluded
    expect(content).toContain('UID:upcoming-1-2025-03-20@creditra');
    expect(content).not.toContain('UID:paid-1-2025-02-10@creditra');
    // Autopay schedule is included as a recurring event
    expect(content).toContain('UID:autopay-line-ap-2025-04-01@creditra');
    expect(content).toContain('RRULE:FREQ=MONTHLY');
    expect(content).toContain('BEGIN:VALARM');

    // Live region announces the download
    const statusRegions = screen.getAllByRole('status');
    expect(
      statusRegions.some((el) =>
        /Downloaded creditra-repayment-schedule\.ics with 5 events/i.test(
          el.textContent ?? '',
        ),
      ),
    ).toBe(true);
  });
});
