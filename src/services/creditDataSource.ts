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
    typeof transaction.id === 'string' &&
    typeof transaction.owner === 'string' &&
    ['Completed', 'Pending', 'Failed'].includes(String(transaction.status)) &&
    typeof transaction.creditLineId === 'string' &&
    typeof transaction.creditLineName === 'string' &&
    typeof transaction.amount === 'number' &&
    typeof transaction.remainingDebt === 'number' &&
    typeof transaction.limit === 'number' &&
    typeof transaction.apr === 'number' &&
    typeof transaction.timestamp === 'string'
  );
}

function readTransactions(): RepaymentTransaction[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const transactions: unknown = JSON.parse(stored);
  if (!Array.isArray(transactions) || !transactions.every(isRepaymentTransaction)) {
    throw new Error('Stored repayment transactions are invalid.');
  }
  return transactions;
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
