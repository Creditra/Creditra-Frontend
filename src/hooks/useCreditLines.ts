import { useMemo } from 'react';
import { CreditDataError } from '../services/credit/CreditDataSource';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine, Transaction } from '../types/creditLine';
import type { WalletInfo } from '../types/wallet';
import { useCreditData } from '../context/CreditDataContext';

export interface UseCreditLinesResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  lines: CreditLine[];
  error: Error | null;
  refetch: () => Promise<CreditLine[]>;
  lastUpdatedAt: Date | null;
  owner: string | null;
  wallet: WalletInfo | null;
  setLines: (lines: CreditLine[]) => void;
}

export interface UseCreditLineResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  line: CreditLine | null;
  error: Error | null;
  owner: string | null;
  wallet: WalletInfo | null;
}

export interface CreditTransaction extends Transaction {
  lineName: string;
  lineId: string;
  lineStatus: CreditLine['status'];
}

export interface UseCreditTransactionsOptions {
  lineId?: string;
  cursor?: string;
  limit?: number;
}

export interface UseCreditTransactionsResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  transactions: CreditTransaction[];
  nextCursor: string | null;
  error: Error | null;
  refetch: () => Promise<CreditTransaction[]>;
  lastUpdatedAt: Date | null;
  owner: string | null;
  wallet: WalletInfo | null;
}

let legacyLines: CreditLine[] = [...MOCK_CREDIT_LINES];
let legacyRefetchError: Error | null = null;
export const setMockRefetchError = (error: Error | null) => { legacyRefetchError = error; };
export const getMockRefetchError = () => legacyRefetchError;
export const setGlobalCreditLines = (lines: CreditLine[]) => { legacyLines = [...lines]; };
export const getGlobalCreditLines = () => legacyLines;
export const resetGlobalCreditLines = () => {
  legacyLines = [...MOCK_CREDIT_LINES];
  legacyRefetchError = null;
};

function paginateTransactions(
  transactions: CreditTransaction[],
  query: UseCreditTransactionsOptions,
): Pick<UseCreditTransactionsResult, 'transactions' | 'nextCursor'> {
  const cursorIndex = query.cursor
    ? Math.max(0, transactions.findIndex((transaction) => transaction.id === query.cursor) + 1)
    : 0;
  const limit = query.limit === undefined ? transactions.length : Math.max(0, query.limit);
  const page = transactions.slice(cursorIndex, cursorIndex + limit);
  const hasNext = cursorIndex + limit < transactions.length;
  return {
    transactions: page,
    nextCursor: hasNext && page.length > 0 ? page[page.length - 1].id : null,
  };
}

function sortTransactions(transactions: CreditTransaction[]): CreditTransaction[] {
  return transactions.sort((a, b) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return timeDiff || b.id.localeCompare(a.id);
  });
}

export function useCreditLines(): UseCreditLinesResult {
  return useCreditData();
}

export function useCreditLine(id: string): UseCreditLineResult {
  const { status, lines, error, owner, wallet } = useCreditData();
  if (status !== 'success') return { status, line: null, error, owner, wallet };
  const line = lines.find((entry) => entry.id === id) ?? null;
  return line
    ? { status: 'success', line, error: null, owner, wallet }
    : {
        status: 'error',
        line: null,
        error: new CreditDataError('not_found', `Credit line not found: ${id}`),
        owner,
        wallet,
      };
}

export function useCreditTransactions(
  query: UseCreditTransactionsOptions = {},
): UseCreditTransactionsResult {
  const { status, lines, error, lastUpdatedAt, owner, wallet, refetch: refetchLines } = useCreditData();
  const allTransactions = useMemo(() => {
    const transactions: CreditTransaction[] = [];
    for (const line of lines) {
      if (query.lineId && line.id !== query.lineId) continue;
      for (const transaction of line.transactions ?? []) {
        transactions.push({
          ...transaction,
          lineId: line.id,
          lineName: line.name,
          lineStatus: line.status,
        });
      }
    }
    return sortTransactions(transactions);
  }, [lines, query.lineId]);

  const page = paginateTransactions(allTransactions, query);

  return {
    status,
    ...page,
    error,
    refetch: async () => {
      const refreshedLines = await refetchLines();
      const refreshed = refreshedLines.flatMap((line) =>
        (query.lineId && line.id !== query.lineId ? [] : line.transactions ?? []).map((transaction) => ({
          ...transaction,
          lineId: line.id,
          lineName: line.name,
          lineStatus: line.status,
        })),
      );
      return paginateTransactions(sortTransactions(refreshed), query).transactions;
    },
    lastUpdatedAt,
    owner,
    wallet,
  };
}
