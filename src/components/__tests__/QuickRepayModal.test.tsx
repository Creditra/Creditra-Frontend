import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QuickRepayModal } from '../QuickRepayModal';
import { submitRepayment } from '../../services/repayService';
import type { RepaymentTransaction } from '../../services/creditDataSource';

vi.mock('../../services/repayService', () => ({
  submitRepayment: vi.fn(),
}));

const submitRepaymentMock = vi.mocked(submitRepayment);

const creditLine = {
  id: 'cl-quick',
  name: 'Quick Line',
  limit: 10_000,
  utilized: 1_000,
  apr: 8,
};

const transaction: RepaymentTransaction = {
  id: 'TXN-test',
  owner: 'GTEST',
  status: 'Completed',
  creditLineId: creditLine.id,
  creditLineName: creditLine.name,
  amount: 100,
  remainingDebt: 900,
  limit: creditLine.limit,
  apr: creditLine.apr,
  timestamp: '2026-11-22T12:00:00.000Z',
};

function renderModal(overrides: Partial<ComponentProps<typeof QuickRepayModal>> = {}) {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const refetch = vi.fn().mockResolvedValue([]);

  render(
    <QuickRepayModal
      creditLine={creditLine}
      walletBalance={5000}
      balanceStatus="ok"
      walletConnected
      walletPublicKey="GTEST"
      initialAmount="100"
      onClose={onClose}
      onSuccess={onSuccess}
      refetch={refetch}
      {...overrides}
    />,
  );

  return { onSuccess, onClose, refetch };
}

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('QuickRepayModal — real submission path', () => {
  beforeEach(() => {
    submitRepaymentMock.mockReset();
    setNavigatorOnLine(true);
  });

  afterEach(() => {
    setNavigatorOnLine(true);
    vi.restoreAllMocks();
  });

  it('submits the repayment and shows success only after the service resolves', async () => {
    let resolveSubmission!: (value: RepaymentTransaction) => void;
    submitRepaymentMock.mockImplementation(
      () => new Promise((resolve) => { resolveSubmission = resolve; }),
    );
    const { onSuccess, refetch } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(screen.getByText(/Processing repayment/i)).toBeInTheDocument();
    expect(screen.queryByText(/You repaid/i)).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveSubmission(transaction);
    });

    expect(await screen.findByText(/You repaid \$100\.00/i)).toBeInTheDocument();
    expect(submitRepaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        walletPublicKey: 'GTEST',
        creditLineId: creditLine.id,
        creditLineName: creditLine.name,
        amount: 100,
      }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }));
    expect(onSuccess).toHaveBeenCalledWith(100);
  });

  it('shows an error step with retry when the service rejects, and reuses the idempotency key', async () => {
    submitRepaymentMock
      .mockRejectedValueOnce(new Error('Boom'))
      .mockResolvedValueOnce(transaction);
    const { onSuccess } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(await screen.findByText('Repayment failed')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.queryByText(/You repaid/i)).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/You repaid \$100\.00/i)).toBeInTheDocument();
    expect(submitRepaymentMock).toHaveBeenCalledTimes(2);

    const firstTransactionId = submitRepaymentMock.mock.calls[0][0].transactionId;
    const secondTransactionId = submitRepaymentMock.mock.calls[1][0].transactionId;
    expect(firstTransactionId).toBeTruthy();
    expect(secondTransactionId).toBe(firstTransactionId);
  });

  it('never shows success while offline and retries successfully after reconnecting', async () => {
    setNavigatorOnLine(false);
    submitRepaymentMock.mockResolvedValue(transaction);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(await screen.findByText('Repayment failed')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(submitRepaymentMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/You repaid/i)).not.toBeInTheDocument();

    setNavigatorOnLine(true);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/You repaid \$100\.00/i)).toBeInTheDocument();
    expect(submitRepaymentMock).toHaveBeenCalledTimes(1);
  });

  it('submits only once on a double click', async () => {
    let resolveSubmission!: (value: RepaymentTransaction) => void;
    submitRepaymentMock.mockImplementation(
      () => new Promise((resolve) => { resolveSubmission = resolve; }),
    );
    renderModal();

    const confirm = screen.getByRole('button', { name: /confirm repayment/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(submitRepaymentMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmission(transaction);
    });
    expect(await screen.findByText(/You repaid \$100\.00/i)).toBeInTheDocument();
  });

  it('shows an error step instead of calling the service when no wallet key is available', async () => {
    renderModal({ walletPublicKey: null });

    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

    expect(await screen.findByText('Repayment failed')).toBeInTheDocument();
    expect(screen.getByText(/connect a wallet/i)).toBeInTheDocument();
    expect(submitRepaymentMock).not.toHaveBeenCalled();
  });
});
