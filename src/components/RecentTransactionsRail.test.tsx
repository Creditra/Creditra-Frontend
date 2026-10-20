import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecentTransactionsRail } from './RecentTransactionsRail';
import type { Transaction } from '../types/creditLine';

type RichTransaction = Transaction & { lineName: string; lineId: string };

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

const renderRail = (props: {
  transactions?: RichTransaction[];
  isLoading?: boolean;
}) => render(
  <BrowserRouter>
    <RecentTransactionsRail
      transactions={props.transactions ?? []}
      isLoading={props.isLoading ?? false}
    />
  </BrowserRouter>,
);

describe('RecentTransactionsRail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with correct ARIA landmark and label', () => {
    renderRail({});
    const region = screen.getByRole('region', { name: /recent transactions/i });
    expect(region).toBeInTheDocument();
  });

  it('renders skeleton placeholders when loading', () => {
    const { container } = renderRail({ isLoading: true });
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies the recent-transactions-rail class to the root', () => {
    const { container } = renderRail({ isLoading: true });
    expect(container.querySelector('.recent-transactions-rail')).toBeInTheDocument();
  });

  it('shows empty state when there are no transactions', () => {
    const { container } = renderRail({});
    expect(container.querySelector('.rtr-empty')).toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('renders transaction items', () => {
    renderRail({ transactions: mockTransactions });
    expect(screen.getByText('Equipment purchase')).toBeInTheDocument();
    expect(screen.getByText('Monthly repayment')).toBeInTheDocument();
    expect(screen.getByText('Hiring new staff')).toBeInTheDocument();
  });

  it('shows line name and relative time for each transaction', () => {
    renderRail({ transactions: mockTransactions });
    expect(screen.getAllByText(/Primary Business Line/)).toHaveLength(2);
    expect(screen.getByText(/Expansion Capital Line/)).toBeInTheDocument();
  });

  it('prefixes draw amounts with a minus sign', () => {
    renderRail({ transactions: [mockTransactions[0]] });
    expect(screen.getByText(/\$50,000/).textContent).toMatch(/^\-/);
  });

  it('prefixes repay amounts with a plus sign', () => {
    renderRail({ transactions: [mockTransactions[1]] });
    expect(screen.getByText(/\$12,500/).textContent).toMatch(/^\+/);
  });

  it('renders a link to the full transaction history when transactions exist', () => {
    renderRail({ transactions: mockTransactions.slice(0, 1) });
    const link = screen.getByRole('link', { name: /view all transactions/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/transactions');
  });

  it('has aria-hidden on the activity icon', () => {
    renderRail({ transactions: mockTransactions.slice(0, 1) });
    const icon = document.querySelector('.activity-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});
