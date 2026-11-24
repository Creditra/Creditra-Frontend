import { writeJson } from '../utils/storage';

export type RepaymentStatus = 'Completed' | 'Pending' | 'Failed';

export interface RepaymentTransaction {
  id: string;
  owner: string;
  status: RepaymentStatus;
  creditLineId: string;
  creditLineName: string;
  amount: number;
  remainingDebt: number;
  limit: number;
  apr: number;
  nextPaymentAmount?: number;
  timestamp: string;
}

export interface CreditDataSource {
  getTransaction(owner: string, transactionId: string): Promise<RepaymentTransaction | null>;
}

const STORAGE_KEY = 'creditra.repayment-transactions';

function isRepaymentTransaction(value: unknown): value is RepaymentTransaction {
  if (!value || typeof value !== 'object') return false;
  const transaction = value as Record<string, unknown>;
  return (
    typeof transaction.id === 'string' && transaction.id.length > 0 &&
    typeof transaction.owner === 'string' && transaction.owner.length > 0 &&
    (transaction.status === 'Completed' || transaction.status === 'Pending' || transaction.status === 'Failed') &&
    typeof transaction.creditLineId === 'string' &&
    typeof transaction.creditLineName === 'string' &&
    typeof transaction.amount === 'number' && Number.isFinite(transaction.amount) &&
    typeof transaction.remainingDebt === 'number' && Number.isFinite(transaction.remainingDebt) &&
    typeof transaction.limit === 'number' && Number.isFinite(transaction.limit) &&
    typeof transaction.apr === 'number' && Number.isFinite(transaction.apr) &&
    typeof transaction.timestamp === 'string'
  );
}

interface TransactionReadResult {
  transactions: RepaymentTransaction[];
  corrupted: boolean;
}

function readTransactionResult(): TransactionReadResult {
  try {
    if (typeof window === 'undefined') return { transactions: [], corrupted: false };
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return { transactions: [], corrupted: false };

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return { transactions: [], corrupted: true };
    }

    if (!Array.isArray(parsed)) {
      return { transactions: [], corrupted: true };
    }

    const valid = parsed.filter(isRepaymentTransaction);
    return { transactions: valid, corrupted: valid.length !== parsed.length };
  } catch {
    return { transactions: [], corrupted: false };
  }
}

export function readTransactions(): RepaymentTransaction[] {
  const result = readTransactionResult();
  if (result.corrupted) {
    console.warn('Dropped corrupt stored repayment transaction rows.');
  }
  return result.transactions;
}

export const creditDataSource: CreditDataSource = {
  async getTransaction(owner, transactionId) {
    const transaction = readTransactions().find((entry) => entry.id === transactionId);
    return transaction?.owner === owner ? transaction : null;
  },
};

export function saveMockRepaymentTransaction(transaction: RepaymentTransaction): void {
  const transactions = readTransactions().filter((entry) => entry.id !== transaction.id);
  transactions.push(transaction);
  writeJson(STORAGE_KEY, transactions);
}
