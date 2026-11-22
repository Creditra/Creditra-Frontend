import {
  saveMockRepaymentTransaction,
  type RepaymentTransaction,
} from './creditDataSource';

export interface RepaySubmission {
  /** Wallet that owns the repayment. */
  walletPublicKey: string;
  creditLineId: string;
  creditLineName: string;
  amount: number;
  remainingDebt: number;
  limit: number;
  apr: number;
  nextPaymentAmount?: number;
  /** Reuse the same id across retries so a duplicate submission is idempotent. */
  transactionId?: string;
  timestamp?: string;
}

/** Builds the persisted repayment record for a confirmed submission. */
export function buildRepaymentTransaction(
  submission: RepaySubmission,
): RepaymentTransaction {
  if (!submission.walletPublicKey) {
    throw new Error('Connect a wallet before submitting a repayment.');
  }
  if (!Number.isFinite(submission.amount) || submission.amount <= 0) {
    throw new Error('Repayment amount must be greater than zero.');
  }

  return {
    id: submission.transactionId ?? `TXN-${Date.now()}`,
    owner: submission.walletPublicKey,
    status: 'Completed',
    creditLineId: submission.creditLineId,
    creditLineName: submission.creditLineName,
    amount: submission.amount,
    remainingDebt: submission.remainingDebt,
    limit: submission.limit,
    apr: submission.apr,
    nextPaymentAmount: submission.nextPaymentAmount,
    timestamp: submission.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Records a successful repayment.
 *
 * Both RepayPage and QuickRepayModal route confirmation through this helper so
 * the persisted transaction shape stays identical across entry points.
 */
export async function submitRepayment(
  submission: RepaySubmission,
): Promise<RepaymentTransaction> {
  const transaction = buildRepaymentTransaction(submission);
  saveMockRepaymentTransaction(transaction);
  return transaction;
}
