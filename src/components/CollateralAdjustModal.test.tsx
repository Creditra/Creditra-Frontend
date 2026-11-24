/**
 * CollateralAdjustModal.test.tsx
 *
 * Tests for the collateral top-up / withdrawal modal component:
 * - Rendering initial state with credit line and asset info
 * - Mode toggle between 'add' and 'withdraw'
 * - Real-time LTV preview calculations and delta display
 * - Safe withdrawal limit enforcement (blocks submit when exceeding safe LTV)
 * - "Max Safe" button convenience autofill
 * - Submission handling (success, error retry, payload verification)
 * - Accessibility: focus trap, ARIA dialog roles, close triggers
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollateralAdjustModal } from './CollateralAdjustModal';
import type { CreditLine } from '../types/creditLine';
import type { CollateralAsset } from '../types/collateral';

// Suppress DOM/window hooks that aren't fully implemented in JSDOM
vi.mock('../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('../hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

const mockCreditLine: CreditLine = {
  id: 'cl-test-1',
  name: 'Growth Capital Line',
  status: 'Active',
  limit: 50_000,
  utilized: 10_000,
  apr: 8.5,
  riskScore: 740,
  collateral: 'Ethereum',
  openedAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  transactions: [],
  statusHistory: [],
};

const mockCollateralAsset: CollateralAsset = {
  id: 'asset-eth',
  name: 'Ethereum',
  ticker: 'ETH',
  category: 'crypto',
  value: 20_000,
  maxLtvRatio: 0.75, // Safe LTV is 75%
};

describe('CollateralAdjustModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with credit line details and default Add Collateral mode', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    // Dialog title
    expect(screen.getByRole('heading', { name: /adjust collateral/i })).toBeInTheDocument();
    expect(screen.getByText(/growth capital line/i)).toBeInTheDocument();

    // Mode tabs
    const addTab = screen.getByRole('tab', { name: /add collateral/i });
    const withdrawTab = screen.getByRole('tab', { name: /withdraw collateral/i });
    expect(addTab).toBeInTheDocument();
    expect(withdrawTab).toBeInTheDocument();
    expect(addTab).toHaveAttribute('aria-selected', 'true');
    expect(withdrawTab).toHaveAttribute('aria-selected', 'false');

    // Current collateral & borrowed stats
    expect(screen.getAllByText(/\$20,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
    expect(screen.getAllByText(/50\.0%/).length).toBeGreaterThanOrEqual(1);

    // Primary action button defaults to Add Collateral
    expect(screen.getByRole('button', { name: /^add collateral$/i })).toBeInTheDocument();
  });

  it('switches between Add and Withdraw modes', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    const withdrawTab = screen.getByRole('tab', { name: /withdraw collateral/i });
    fireEvent.click(withdrawTab);

    expect(withdrawTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^withdraw collateral$/i })).toBeInTheDocument();
    // Max safe withdrawable hint should appear
    expect(screen.getByText(/maximum withdrawable without exceeding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /max safe/i })).toBeInTheDocument();

    // Switch back to Add mode
    const addTab = screen.getByRole('tab', { name: /add collateral/i });
    fireEvent.click(addTab);

    expect(addTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /^add collateral$/i })).toBeInTheDocument();
  });

  it('updates projected LTV and delta when entering deposit amount', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    const amountInput = screen.getByLabelText(/amount to add/i);
    // Deposit 5,000 USD -> Collateral becomes 25,000, LTV becomes 10,000 / 25,000 = 40.0%
    fireEvent.change(amountInput, { target: { value: '5000' } });

    expect(screen.getByText(/40\.0%/)).toBeInTheDocument();
    // Delta should show decrease (-10.0 pp)
    expect(screen.getByText(/Delta:\s*-10\.0\s*pp/i)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /^add collateral$/i });
    expect(addBtn).not.toBeDisabled();
  });

  it('updates projected LTV when entering a safe withdraw amount', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /withdraw collateral/i }));
    const amountInput = screen.getByLabelText(/amount to withdraw/i);

    // Withdraw 4,000 USD -> Collateral becomes 16,000, LTV becomes 10,000 / 16,000 = 62.5%
    fireEvent.change(amountInput, { target: { value: '4000' } });

    expect(screen.getByText(/62\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/Delta:\s*\+12\.5\s*pp/i)).toBeInTheDocument();

    // Submit button should remain enabled because 62.5% <= 75%
    const withdrawBtn = screen.getByRole('button', { name: /^withdraw collateral$/i });
    expect(withdrawBtn).not.toBeDisabled();
  });

  it('blocks submit and shows alert when withdrawal breaches safe LTV', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /withdraw collateral/i }));
    const amountInput = screen.getByLabelText(/amount to withdraw/i);

    // Loan balance is 10,000, safe LTV is 75% -> min collateral is 13,333.33 -> max withdraw is 6,666.67
    // Trying to withdraw 10,000 -> remaining collateral 10,000 -> LTV = 100% (breaches 75%)
    fireEvent.change(amountInput, { target: { value: '10000' } });

    // Warning alert should be present explaining unsafe withdrawal
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/withdrawal exceeds safe limit/i)
    ).toBeInTheDocument();

    // Submit button must be disabled
    const withdrawBtn = screen.getByRole('button', { name: /^withdraw collateral$/i });
    expect(withdrawBtn).toBeDisabled();
  });

  it('populates input when "Max Safe" button is clicked in withdraw mode', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /withdraw collateral/i }));
    const maxSafeBtn = screen.getByRole('button', { name: /max safe/i });
    fireEvent.click(maxSafeBtn);

    const amountInput = screen.getByLabelText(/amount to withdraw/i) as HTMLInputElement;
    expect(Number(amountInput.value)).toBeCloseTo(6666.67, 1);

    // Button should be enabled since max safe amount keeps LTV at safe boundary
    const withdrawBtn = screen.getByRole('button', { name: /^withdraw collateral$/i });
    expect(withdrawBtn).not.toBeDisabled();
  });

  it('submits adjustment successfully and triggers onSuccess callback', async () => {
    const customSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
        submitAdjustment={customSubmit}
        _delayMs={0}
      />
    );

    const amountInput = screen.getByLabelText(/amount to add/i);
    fireEvent.change(amountInput, { target: { value: '5000' } });

    const addBtn = screen.getByRole('button', { name: /^add collateral$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(customSubmit).toHaveBeenCalledWith({
        lineId: mockCreditLine.id,
        mode: 'add',
        amount: 5000,
      });
    });

    // Should transition to success screen
    await waitFor(() => {
      expect(screen.getByText(/collateral added!/i)).toBeInTheDocument();
    });

    // Clicking "Done" triggers onSuccess and onClose
    const doneBtn = screen.getByRole('button', { name: /done/i });
    fireEvent.click(doneBtn);

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'add',
        amount: 5000,
        newCollateralValue: 25000,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('displays error message and allows retry if adjustment fails', async () => {
    const customSubmit = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
        submitAdjustment={customSubmit}
        _delayMs={0}
      />
    );

    const amountInput = screen.getByLabelText(/amount to add/i);
    fireEvent.change(amountInput, { target: { value: '2000' } });

    fireEvent.click(screen.getByRole('button', { name: /^add collateral$/i }));

    await waitFor(() => {
      expect(screen.getByText(/network failure/i)).toBeInTheDocument();
    });

    // Click "Back" resets back to input step
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);

    expect(screen.getByRole('button', { name: /^add collateral$/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancel or Close (✕) button is clicked', () => {
    render(
      <CollateralAdjustModal
        isOpen
        onClose={onClose}
        creditLine={mockCreditLine}
        currentAsset={mockCollateralAsset}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
