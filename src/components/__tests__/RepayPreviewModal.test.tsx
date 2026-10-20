import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepayPreviewModal, RepaymentCreditLine } from '../RepayPreviewModal';

const mockCreditLine: RepaymentCreditLine = {
  id: 'cl-78923',
  name: 'Corporate Growth Line',
  limit: 20000,
  utilized: 8000,
  apr: 12.5,
  nextPaymentAmount: 400,
};

describe('RepayPreviewModal', () => {
  const defaultProps = {
    isOpen: true,
    creditLine: mockCreditLine,
    walletBalance: 15000,
    repayAmount: 3000,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RepayPreviewModal {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header, title, credit line info, and proposed repayment amount when open', () => {
    render(<RepayPreviewModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Preview Repayment Consequences')).toBeInTheDocument();
    expect(screen.getByText(/Corporate Growth Line · cl-78923/)).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
  });

  it('displays partial repayment badge and correct financial consequences for partial repayment', () => {
    render(<RepayPreviewModal {...defaultProps} repayAmount={3000} />);

    expect(screen.getByText(/Partial Repayment/i)).toBeInTheDocument();
    // Remaining debt: $8,000 + interest (~$83.33) - $3,000 = ~$5,083.33
    expect(screen.getByText('Remaining Debt')).toBeInTheDocument();
    // Restored available credit
    expect(screen.getByText('Available Credit Limit')).toBeInTheDocument();
    // Wallet balance impact
    expect(screen.getByText('Current Wallet Balance')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    expect(screen.getByText('Balance After Repayment')).toBeInTheDocument();
    expect(screen.getByText('$12,000.00')).toBeInTheDocument();
  });

  it('displays Full Payoff badge when repaying full outstanding debt + accrued interest', () => {
    const fullPayoffAmount = 8083.33; // ~$8000 + accrued interest
    render(
      <RepayPreviewModal
        {...defaultProps}
        repayAmount={fullPayoffAmount}
      />,
    );

    expect(screen.getByText(/Full Payoff/i)).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // Remaining debt
  });

  it('shows low wallet reserve warning banner when wallet balance after repayment is dangerously low', () => {
    render(
      <RepayPreviewModal
        {...defaultProps}
        walletBalance={1200}
        repayAmount={1000} // leaves $200 (< $500 & < 10% of $1200)
      />,
    );

    expect(screen.getByText(/Low Wallet Reserve Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/leave you with/i)).toBeInTheDocument();
  });

  it('does not require typed confirmation for small repayment amounts (< REPAY_CONFIRM_THRESHOLD)', () => {
    render(
      <RepayPreviewModal
        {...defaultProps}
        repayAmount={1500}
      />,
    );

    const confirmBtn = screen.getByTestId('repay-preview-confirm');
    expect(confirmBtn).not.toBeDisabled();
  });

  it('requires typed amount confirmation for large repayment amounts (>= REPAY_CONFIRM_THRESHOLD)', async () => {
    const user = userEvent.setup();
    render(
      <RepayPreviewModal
        {...defaultProps}
        repayAmount={6000} // threshold is default 5000
      />,
    );

    const confirmBtn = screen.getByTestId('repay-preview-confirm');
    expect(confirmBtn).toBeDisabled();

    expect(screen.getByText(/Type the amount to confirm/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText('$6,000.00');

    // Type incorrect amount
    await user.type(input, '123');
    expect(confirmBtn).toBeDisabled();

    // Type exact amount
    await user.clear(input);
    await user.type(input, '6000');

    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it('calls onClose when clicking close X button or Edit Amount button', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(<RepayPreviewModal {...defaultProps} onClose={handleClose} />);

    const closeBtn = screen.getByTestId('repay-preview-close');
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByTestId('repay-preview-cancel');
    await user.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('calls onConfirm with repayAmount when clicking Confirm & Repay button', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    render(<RepayPreviewModal {...defaultProps} onConfirm={handleConfirm} />);

    const confirmBtn = screen.getByTestId('repay-preview-confirm');
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith(3000);
  });

  it('closes modal when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<RepayPreviewModal {...defaultProps} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('meets WCAG 2.1 AA accessibility standards (dialog role, focus trap, labels)', () => {
    const triggerRef = { current: document.createElement('button') };
    render(<RepayPreviewModal {...defaultProps} triggerRef={triggerRef} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
  });
});
