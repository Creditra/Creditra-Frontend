import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecentTransactionsRail } from './RecentTransactionsRail';
import type { Transaction, TransactionType } from '../types/creditLine';

/*
 * Issue #1205 — this file merges the two former RecentTransactionsRail suites
 * (`src/components/RecentTransactionsRail.test.tsx` and
 * `src/components/__tests__/RecentTransactionsRail.test.tsx`); every unique
 * case from both is preserved below.
 *
 * Router: the component only needs `Link`, but it is rendered under a real
 * `MemoryRouter` (not the aliased stub) so the suite never depends on the
 * stub's module-level location state. See `src/test/realRouter.ts`.
 *
 * Time: `relativeTime()` compares against `Date.now()`, so the clock is pinned
 * to a fixed instant.  The assertions only use instant deltas (m/h/d) and, for
 * the absolute-date fallback, a label derived from the same instant in the
 * local timezone (see `localDateLabel`), so the suite is timezone-independent
 * rather than merely passing in the two timezones named in the issue.
 * Verified under `TZ=UTC`, `TZ=America/Los_Angeles`, `TZ=Asia/Kolkata`,
 * `TZ=Pacific/Auckland` and `TZ=Pacific/Kiritimati`.
 */
vi.mock('react-router-dom', async () => await import('../test/realRouter'));

type RichTransaction = Transaction & { lineName: string; lineId: string };

const NOW = '2025-02-20T12:00:00Z';

/** The rail's absolute-date fallback, in the runner's local timezone. */
const localDateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function buildTx(
  overrides: Partial<Transaction> & { type: TransactionType },
): RichTransaction {
  return {
    id: 'TX-test',
    amount: 1000,
    date: NOW,
    status: 'Completed' as const,
    lineName: 'Test Line',
    lineId: 'CL-001',
    note: 'Test transaction',
    ...overrides,
  };
}

const mockTransactions: RichTransaction[] = [
  {
    id: 'TX-001',
    type: 'Draw',
    amount: 50000,
    date: '2025-02-18T10:30:00Z',
    note: 'Equipment purchase',
    status: 'Completed',
    lineName: 'Primary Business Line',
    lineId: 'CL-2024-001',
  },
  {
    id: 'TX-002',
    type: 'Repay',
    amount: 12500,
    date: '2025-02-10T14:15:00Z',
    note: 'Monthly repayment',
    status: 'Completed',
    lineName: 'Primary Business Line',
    lineId: 'CL-2024-001',
  },
  {
    id: 'TX-010',
    type: 'Draw',
    amount: 75000,
    date: '2025-01-10T10:00:00Z',
    note: 'Hiring new staff',
    status: 'Completed',
    lineName: 'Expansion Capital Line',
    lineId: 'CL-2024-002',
  },
];

const railUi = (props: {
  transactions?: RichTransaction[];
  isLoading?: boolean;
}) => (
  <MemoryRouter initialEntries={['/']}>
    <RecentTransactionsRail
      transactions={props.transactions ?? []}
      isLoading={props.isLoading ?? false}
    />
  </MemoryRouter>
);

const renderRail = (props: {
  transactions?: RichTransaction[];
  isLoading?: boolean;
}) => render(railUi(props));

describe('RecentTransactionsRail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Structure and landmarks ────────────────────────────────────────────────

  it('renders with correct ARIA landmark and label', () => {
    renderRail({});
    const region = screen.getByRole('region', { name: /recent transactions/i });
    expect(region).toBeInTheDocument();
    // The landmark is the only region for a single rail.
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  it('applies the recent-transactions-rail class to the root', () => {
    const { container } = renderRail({ isLoading: true });
    expect(container.querySelector('.recent-transactions-rail')).toBeInTheDocument();
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  it('renders skeleton placeholders when loading', () => {
    const { container } = renderRail({ isLoading: true });
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders loading skeletons', () => {
    const { container } = renderRail({ isLoading: true });
    expect(
      screen.getByRole('region', { name: 'Recent transactions' }),
    ).toBeInTheDocument();
    const activityItems = container.querySelectorAll('.activity-item');
    expect(activityItems.length).toBeGreaterThan(0);
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('shows empty state when there are no transactions', () => {
    const { container } = renderRail({});
    expect(container.querySelector('.rtr-empty')).toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('shows empty state after transactions change from non-empty to empty', () => {
    const tx = buildTx({ id: 'TX-1', type: 'Draw' });
    const { rerender } = renderRail({ transactions: [tx] });
    expect(screen.getByText('Test transaction')).toBeInTheDocument();

    rerender(railUi({ transactions: [] }));

    expect(screen.queryByText('Test transaction')).not.toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  // ── Rows ──────────────────────────────────────────────────────────────────

  it('renders transaction items', () => {
    renderRail({ transactions: mockTransactions });
    expect(screen.getByText('Equipment purchase')).toBeInTheDocument();
    expect(screen.getByText('Monthly repayment')).toBeInTheDocument();
    expect(screen.getByText('Hiring new staff')).toBeInTheDocument();
  });

  it('falls back to the transaction type when the note is absent', () => {
    const txs = [buildTx({ id: 'TX-3', type: 'Interest', note: undefined })];

    renderRail({ transactions: txs });
    expect(screen.getByText('Interest')).toBeInTheDocument();
  });

  it('shows line name and relative time for each transaction', () => {
    renderRail({ transactions: mockTransactions });
    expect(screen.getAllByText(/Primary Business Line/)).toHaveLength(2);
    expect(screen.getByText(/Expansion Capital Line/)).toBeInTheDocument();
    // 2025-02-18T10:30Z is 2 days before the pinned instant — an instant delta,
    // so the label does not depend on the machine's timezone.
    expect(screen.getByText(/2d ago/)).toBeInTheDocument();
  });

  it('shows formatted date for older transactions', () => {
    // More than 30 days old, so the rail prints an absolute date instead of a
    // relative one: "Jan 15, 2025" in UTC/Los Angeles, and the equivalent
    // local calendar day anywhere else.
    const date = '2025-01-15T12:00:00Z';
    const txs = [buildTx({ id: 'TX-1', type: 'Draw', date })];

    renderRail({ transactions: txs });
    expect(screen.getByText(new RegExp(localDateLabel(date)))).toBeInTheDocument();
  });

  it('prefixes draw amounts with a minus sign', () => {
    renderRail({ transactions: [mockTransactions[0]] });
    const amount = screen.getByText(/\$50,000/);
    expect(amount.textContent).toMatch(/^\-/);
  });

  it('prefixes repay amounts with a plus sign', () => {
    renderRail({ transactions: [mockTransactions[1]] });
    const amount = screen.getByText(/\$12,500/);
    expect(amount.textContent).toMatch(/^\+/);
  });

  it('renders correct icon and amount color per transaction type', () => {
    const { container } = renderRail({
      transactions: [mockTransactions[0], mockTransactions[1]],
    });

    const icons = container.querySelectorAll('.activity-icon');
    expect(icons).toHaveLength(2);
    // ↗ for Draw, ↙ for Repay.
    expect(icons[0].textContent).toBe('\u2197');
    expect(icons[1].textContent).toBe('\u2199');

    // Amounts are colour-coded by type, so the two must differ.
    const amounts = container.querySelectorAll<HTMLElement>('.activity-amount');
    expect(amounts).toHaveLength(2);
    expect(amounts[0].style.color).not.toBe('');
    expect(amounts[0].style.color).not.toBe(amounts[1].style.color);
  });

  it('amount element uses semantic color', () => {
    const { container } = renderRail({ transactions: [mockTransactions[0]] });
    const amountEl = container.querySelector<HTMLElement>('.activity-amount');
    expect(amountEl).toBeInTheDocument();
    expect(amountEl?.textContent).toContain('$');
    expect(amountEl?.style.color).not.toBe('');
  });

  it('has aria-hidden on the activity icon', () => {
    renderRail({ transactions: mockTransactions.slice(0, 1) });
    const icon = document.querySelector('.activity-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── Footer link ───────────────────────────────────────────────────────────

  it('renders a link to the full transaction history when transactions exist', () => {
    renderRail({ transactions: mockTransactions.slice(0, 1) });
    const link = screen.getByRole('link', { name: /view all transactions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/transactions');
  });

  // ── Prop changes ──────────────────────────────────────────────────────────

  it('resets history cursor by not retaining previous transactions when transactions prop changes', () => {
    const oldTx = buildTx({ id: 'TX-OLD', type: 'Draw', note: 'Old filter' });
    const { rerender } = renderRail({ transactions: [oldTx] });
    expect(screen.getByText('Old filter')).toBeInTheDocument();

    const newTx = buildTx({ id: 'TX-NEW', type: 'Repay', note: 'New filter' });
    rerender(railUi({ transactions: [newTx] }));

    expect(screen.queryByText('Old filter')).not.toBeInTheDocument();
    expect(screen.getByText('New filter')).toBeInTheDocument();
    // The amount renders as one text node ("+$1,000"); asserting an exact "+"
    // never matched and hid the fact that the row was rendered at all.
    expect(screen.getByText(/\$1,000/).textContent).toMatch(/^\+/);
  });
});
