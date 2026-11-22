import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from '../RepayPage';

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
