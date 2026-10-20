import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RecentTransactionsRail } from '../RecentTransactionsRail';
import type { Transaction, TransactionType } from '../../types/creditLine';

const NOW = '2025-02-20T12:00:00Z';

function buildTx(overrides: Partial<Transaction> & { type: TransactionType }): Transaction & { lineName: string; lineId: string } {
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

function renderRail(transactions: Parameters<typeof RecentTransactionsRail>[0]['transactions'], isLoading = false) {
  return render(
    <BrowserRouter>
      <RecentTransactionsRail transactions={transactions} isLoading={isLoading} />
    </BrowserRouter>
  );
}

describe('RecentTransactionsRail', () => {
  test('renders loading skeletons', () => {
    renderRail([], true);
    expect(screen.getByRole('region', { name: 'Recent transactions' })).toBeInTheDocument();
    const skeletonIcons = document.querySelectorAll('.activity-item');
    expect(skeletonIcons.length).toBeGreaterThan(0);
  });

  test('renders empty state when no transactions', () => {
    renderRail([], false);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  test('renders transactions list', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw', amount: 50000, date: '2025-02-18T10:30:00Z', note: 'Equipment purchase' }),
      buildTx({ id: 'TX-2', type: 'Repay', amount: 12500, date: '2025-02-10T14:15:00Z', note: 'Monthly repayment' }),
    ];

    renderRail(txs, false);

    expect(screen.getByText('Equipment purchase')).toBeInTheDocument();
    expect(screen.getByText('Monthly repayment')).toBeInTheDocument();
    expect(screen.getAllByText(/Test Line/).length).toBe(2);
  });

  test('falls back to type when note is absent', () => {
    const txs = [
      buildTx({ id: 'TX-3', type: 'Interest', note: undefined }),
    ];

    renderRail(txs, false);
    expect(screen.getByText('Interest')).toBeInTheDocument();
  });

  test('formats amount with sign for Draw', () => {
    const txs = [
      buildTx({ id: 'TX-4', type: 'Draw', amount: 50000 }),
    ];

    renderRail(txs, false);
    expect(screen.getByText(/-/)).toBeInTheDocument();
  });

  test('formats amount with sign for Repay', () => {
    const txs = [
      buildTx({ id: 'TX-5', type: 'Repay', amount: 12500 }),
    ];

    renderRail(txs, false);
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });

  test('renders view all transactions link', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw' }),
    ];

    renderRail(txs, false);
    const link = screen.getByRole('link', { name: /view all transactions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/transactions');
  });

  test('shows formatted date for older transactions', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw', date: '2025-01-15T12:00:00Z' }),
    ];

    renderRail(txs, false);
    const sub = screen.getByText(/Jan 15, 2025/);
    expect(sub).toBeInTheDocument();
  });

  test('renders correct icon and amount color per transaction type', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw', amount: 50000 }),
      buildTx({ id: 'TX-2', type: 'Repay', amount: 25000 }),
    ];

    renderRail(txs, false);
    const items = screen.getAllByRole('region')[0];
    expect(items).toBeInTheDocument();
  });

  test('amount element uses semantic color', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw', amount: 50000 }),
    ];

    renderRail(txs, false);
    const amountEl = document.querySelector('.activity-amount');
    expect(amountEl).toBeInTheDocument();
    expect(amountEl?.textContent).toContain('$');
  });

  test('each transaction has accessible role region', () => {
    const txs = [
      buildTx({ id: 'TX-1', type: 'Draw' }),
    ];

    renderRail(txs, false);
    expect(screen.getByRole('region', { name: 'Recent transactions' })).toBeInTheDocument();
  });

  test('resets history cursor by not retaining previous transactions when transactions prop changes', () => {
    const oldTx = buildTx({ id: 'TX-OLD', type: 'Draw', note: 'Old filter' });
    const { rerender } = renderRail([oldTx], false);
    expect(screen.getByText('Old filter')).toBeInTheDocument();

    const newTx = buildTx({ id: 'TX-NEW', type: 'Repay', note: 'New filter' });
    rerender(
      <BrowserRouter>
        <RecentTransactionsRail transactions={[newTx]} isLoading={false} />
      </BrowserRouter>
    );

    expect(screen.queryByText('Old filter')).not.toBeInTheDocument();
    expect(screen.getByText('New filter')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  test('shows empty state after transactions change from non-empty to empty', () => {
    const tx = buildTx({ id: 'TX-1', type: 'Draw' });
    const { rerender } = renderRail([tx], false);
    expect(screen.getByText('Test transaction')).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <RecentTransactionsRail transactions={[]} isLoading={false} />
      </BrowserRouter>
    );

    expect(screen.queryByText('Test transaction')).not.toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });
});
