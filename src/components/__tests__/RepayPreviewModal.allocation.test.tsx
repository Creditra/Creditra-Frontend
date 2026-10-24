import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RepayPreviewModal } from '../RepayPreviewModal';

const creditLine = {
  id: 'cl-1182',
  name: 'Issue 1182 Line',
  limit: 50_000,
  utilized: 10_000,
  apr: 9,
  nextPaymentAmount: 100,
};

function renderModal(repayAmount: number) {
  return render(
    <RepayPreviewModal
      isOpen
      creditLine={creditLine}
      walletBalance={50_000}
      repayAmount={repayAmount}
      onClose={() => {}}
      onConfirm={() => {}}
    />,
  );
}

describe('RepayPreviewModal — principal + interest allocation', () => {
  it('scenario 1: full payoff pays interest first then clears principal', () => {
    renderModal(10_075);

    expect(screen.getByText(/Full Payoff/i)).toBeInTheDocument();
    expect(screen.getByTestId('repay-preview-allocation')).toHaveTextContent(
      'Interest $75.00 · Principal $10,000.00',
    );
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('scenario 2: a 10,000 payment leaves 75 of residual debt', () => {
    renderModal(10_000);

    expect(screen.getByText(/Partial Repayment/i)).toBeInTheDocument();
    expect(screen.getByText('Remaining Debt')).toBeInTheDocument();
    expect(screen.getAllByText('$75.00').length).toBeGreaterThan(0);
    expect(screen.getByTestId('repay-preview-allocation')).toHaveTextContent(
      'Interest $75.00 · Principal $9,925.00',
    );
  });

  it('scenario 3: a payment below interest allocates nothing to principal', () => {
    renderModal(50);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByTestId('repay-preview-allocation'),
    ).toHaveTextContent('Interest $50.00 · Principal $0.00');
  });

  it('scenario 8: full-payoff copy only appears when remaining total is zero', () => {
    const { unmount } = renderModal(10_000);
    expect(screen.queryByText(/Full Payoff/i)).not.toBeInTheDocument();
    unmount();

    renderModal(10_075);
    expect(screen.getByText(/Full Payoff/i)).toBeInTheDocument();
  });
});
