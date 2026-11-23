import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from '../RepayPage';
import * as creditDataSource from '@/services/creditDataSource';

vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 50_000,
      utilized: 10_000,
      apr: 9,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 20_000,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
    {
      id: 'CL-2024-002',
      name: 'Equipment Financing Line',
      status: 'Active',
      limit: 25_000,
      utilized: 2_000,
      apr: 15,
      riskScore: 700,
      collateral: 'Equipment',
      openedAt: '2024-06-01',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 500,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
    {
      id: 'CL-2024-003',
      name: 'Closed Zero Balance Line',
      status: 'Closed',
      limit: 10_000,
      utilized: 0,
      apr: 12,
      riskScore: 710,
      collateral: 'None',
      openedAt: '2023-01-01',
      updatedAt: '2024-01-01T00:00:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 0,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
  ],
}));

function renderPage() {
  const result = render(
    <MemoryRouter initialEntries={['/repay?line=CL-2024-001']}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

function setRepayAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/amount to repay/i), {
    target: { value },
  });
}

function openReview() {
  fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
}

describe('RepayPage — principal + interest allocation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('scenario 1: accepts the full amount owed and shows zero remaining', () => {
    renderPage();
    setRepayAmount('10075');

    expect(screen.getByText('Full repayment')).toBeInTheDocument();

    openReview();
    expect(screen.getByTestId('repay-allocation-summary')).toHaveTextContent(
      'Interest $75.00 · Principal $10,000.00',
    );
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('scenario 2: paying 10,000 leaves interest/residual debt and no "Full repayment" copy', () => {
    renderPage();
    setRepayAmount('10000');

    expect(screen.queryByText('Full repayment')).not.toBeInTheDocument();

    openReview();
    expect(screen.getByTestId('repay-allocation-summary')).toHaveTextContent(
      'Interest $75.00 · Principal $9,925.00',
    );
    expect(screen.getAllByText('$75.00').length).toBeGreaterThan(0);
  });

  it('scenario 4: rejects an amount over the total owed', () => {
    renderPage();
    setRepayAmount('10076');

    expect(screen.getByText('Exceeds outstanding debt')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /review repayment/i }),
    ).toBeDisabled();
  });

  it('scenario 5: Max chip and Smart Pay cap at the total owed', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /maximum/i }));
    expect(screen.getByLabelText(/amount to repay/i)).toHaveValue(10075);

    setRepayAmount('');
    fireEvent.click(screen.getByRole('button', { name: /smart pay/i }));
    expect(screen.getByLabelText(/amount to repay/i)).toHaveValue(10075);
  });

  it('scenario 6: page, preview modal and success state agree on the remaining total', () => {
    renderPage();
    setRepayAmount('10000');

    fireEvent.click(
      screen.getByRole('button', { name: /preview consequences modal/i }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Remaining Debt')).toBeInTheDocument();
    expect(within(dialog).getAllByText('$75.00').length).toBeGreaterThan(0);
    expect(
      within(dialog).getByTestId('repay-preview-allocation'),
    ).toHaveTextContent('Interest $75.00 · Principal $9,925.00');

    fireEvent.click(screen.getByTestId('repay-preview-cancel'));
    openReview();
    fireEvent.change(
      screen.getByLabelText(/type the repayment amount to confirm/i),
      { target: { value: '10000' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(screen.getByText(/you repaid \$10,000\.00/i)).toBeInTheDocument();
    expect(screen.getAllByText('$75.00').length).toBeGreaterThan(0);
  });

  it('scenario 8: only exact payoff produces "Full repayment"', () => {
    renderPage();

    setRepayAmount('10000');
    expect(screen.queryByText('Full repayment')).not.toBeInTheDocument();

    setRepayAmount('10075');
    expect(screen.getByText('Full repayment')).toBeInTheDocument();
  });
});

function renderPickerPage(initialEntry = '/repay') {
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

describe('RepayPage — multi-line batch repayment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('toggles multi-line mode, lists only repayable lines, and updates allocation preview + SR announcement', () => {
    renderPickerPage();

    fireEvent.click(screen.getByTestId('multi-line-repay-toggle'));
    expect(screen.getByTestId('multi-line-repay-panel')).toBeInTheDocument();

    // Closed / zero-balance line must not appear
    expect(screen.queryByText('Closed Zero Balance Line')).not.toBeInTheDocument();
    expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
    expect(screen.getByText('Equipment Financing Line')).toBeInTheDocument();

    // Tick both repayable lines
    fireEvent.click(screen.getByLabelText(/Primary Business Line/i));
    fireEvent.click(screen.getByLabelText(/Equipment Financing Line/i));

    // Enter total amount: Equipment Financing Line (15% APR) owes 2000 + 25 = 2025
    fireEvent.change(screen.getByLabelText(/total amount to repay/i), {
      target: { value: '2500' },
    });

    const preview = screen.getByTestId('batch-allocation-preview');
    const equipRow = within(preview).getByTestId('batch-preview-row-CL-2024-002');
    const primaryRow = within(preview).getByTestId('batch-preview-row-CL-2024-001');

    // Highest APR first: CL-2024-002 paid in full ($25 interest, $2,000 principal, $0 remaining)
    expect(equipRow).toHaveTextContent('$25.00');
    expect(equipRow).toHaveTextContent('$2,000.00');
    expect(equipRow).toHaveTextContent('$0.00');

    // Remaining $475 goes to CL-2024-001 ($75 interest, $400 principal)
    expect(primaryRow).toHaveTextContent('$75.00');
    expect(primaryRow).toHaveTextContent('$400.00');

    // Screen reader live region announces the updated preview
    const liveRegion = document.getElementById('repay-announcement');
    expect(liveRegion).toHaveTextContent(/allocation preview updated for 2 lines/i);
  });

  it('caps overpayment at total owed and displays unallocated remainder', () => {
    renderPickerPage();

    fireEvent.click(screen.getByTestId('multi-line-repay-toggle'));
    fireEvent.click(screen.getByLabelText(/Equipment Financing Line/i));

    // Equipment line owes $2,025; entering $3,000 caps at $2,025 with $975 remainder
    fireEvent.change(screen.getByLabelText(/total amount to repay/i), {
      target: { value: '3000' },
    });

    expect(screen.getByTestId('batch-unallocated-remainder')).toHaveTextContent(
      '$975.00',
    );
  });

  it('submits batch as one action and preserves results when one line fails', () => {
    const saveSpy = vi
      .spyOn(creditDataSource, 'saveMockRepaymentTransaction')
      .mockImplementation((tx) => {
        if (tx.creditLineId === 'CL-2024-001') {
          throw new Error('Network error on primary line');
        }
      });

    renderPickerPage();

    fireEvent.click(screen.getByTestId('multi-line-repay-toggle'));
    fireEvent.click(screen.getByLabelText(/Primary Business Line/i));
    fireEvent.click(screen.getByLabelText(/Equipment Financing Line/i));
    fireEvent.change(screen.getByLabelText(/total amount to repay/i), {
      target: { value: '2500' },
    });

    fireEvent.click(screen.getByTestId('batch-repay-submit'));

    expect(saveSpy).toHaveBeenCalledTimes(2);
    const results = screen.getByTestId('batch-repay-results');
    expect(results).toHaveTextContent('1 of 2 repayments completed');
    expect(
      within(results).getByTestId('batch-result-row-CL-2024-002'),
    ).toHaveTextContent('Completed');
    expect(
      within(results).getByTestId('batch-result-row-CL-2024-001'),
    ).toHaveTextContent('Failed');
    expect(
      within(results).getByTestId('batch-result-row-CL-2024-001'),
    ).toHaveTextContent('Network error on primary line');
  });
});
