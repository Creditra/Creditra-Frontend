import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreditDataError, type CreditDataSource } from '../services/credit/CreditDataSource';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import { now } from '../lib/clock';
import type { CreditLine, Transaction } from '../types/creditLine';
import type { WalletInfo } from '../types/wallet';
import { useCreditData, type CreditDataStatus } from '../context/CreditDataContext';

export interface UseCreditLinesResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  lines: CreditLine[];
  error: Error | null;
  refetch: () => Promise<CreditLine[]>;
  lastUpdatedAt: Date | null;
  owner: string | null;
  wallet: WalletInfo | null;
  setLines: (lines: CreditLine[]) => void;
  source: CreditDataSource;
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
  status: CreditDataStatus;
  transactions: CreditTransaction[];
  nextCursor: string | null;
  error: Error | null;
  refetch: () => Promise<CreditTransaction[]>;
  lastUpdatedAt: Date | null;
  owner: string | null;
  wallet: WalletInfo | null;
  /**
   * True when `transactions` is one page fetched from the ledger, so `nextCursor`
   * is a server cursor and the caller must not paginate or re-order locally.
   */
  serverPaged: boolean;
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

/**
 * A source pages history from the ledger only when it both identifies itself as
 * on-chain and implements the optional history member of the port. Views use the
 * same gate to decide whether their cursor is a server cursor.
 */
export function usesLedgerHistory(source: CreditDataSource | undefined): boolean {
  return source?.kind === 'soroban' && typeof source.listTransactions === 'function';
}

function decorateTransaction(row: Transaction, lines: CreditLine[]): CreditTransaction {
  const line = row.lineId ? lines.find((entry) => entry.id === row.lineId) : undefined;
  return {
    ...row,
    lineId: row.lineId ?? '',
    lineName: line?.name ?? row.lineId ?? 'On-chain activity',
    // A chain row whose line is not in the loaded set has no status to report;
    // Active renders the least misleading badge.
    lineStatus: line?.status ?? 'Active',
  };
}

interface ServerPageState {
  status: CreditDataStatus;
  rows: Transaction[];
  nextCursor: string | null;
  error: Error | null;
  lastUpdatedAt: Date | null;
}

const IDLE_PAGE: ServerPageState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  error: null,
  lastUpdatedAt: null,
};

/**
 * Requests one page of history from a ledger-backed source. The cursor is handed
 * to the source untouched, and a superseded request (new cursor, filter change,
 * unmount) is aborted and its result discarded instead of applied to state.
 */
function useServerTransactions(
  source: CreditDataSource | null,
  owner: string | null,
  query: UseCreditTransactionsOptions,
): ServerPageState & { load: () => Promise<Transaction[]> } {
  const [page, setPage] = useState<ServerPageState>(IDLE_PAGE);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const { cursor = null, limit, lineId } = query;

  const load = useCallback(async (): Promise<Transaction[]> => {
    if (!source?.listTransactions || !owner) return [];
    const id = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPage((previous) => ({
      ...previous,
      status: previous.rows.length > 0 ? 'success' : 'loading',
      error: null,
    }));
    try {
      const result = await source.listTransactions(owner, {
        cursor,
        limit,
        lineId,
        signal: controller.signal,
      });
      if (id !== requestId.current) return [];
      setPage({
        status: 'success',
        rows: result.transactions,
        nextCursor: result.nextCursor,
        error: null,
        lastUpdatedAt: now(),
      });
      return result.transactions;
    } catch (reason) {
      if (id !== requestId.current) return [];
      const error = reason instanceof Error ? reason : new Error(String(reason));
      setPage((previous) => ({
        ...previous,
        status: 'error',
        rows: [],
        nextCursor: null,
        error,
      }));
      throw error;
    }
  }, [cursor, limit, lineId, owner, source]);

  useEffect(() => {
    if (!source || !owner) {
      requestId.current += 1;
      setPage(IDLE_PAGE);
      return;
    }
    void load().catch(() => undefined);
    return () => {
      requestId.current += 1;
      controllerRef.current?.abort();
    };
  }, [load, owner, source]);

  return { ...page, load };
}

export function useCreditTransactions(
  query: UseCreditTransactionsOptions = {},
): UseCreditTransactionsResult {
  const {
    status,
    lines,
    error,
    lastUpdatedAt,
    owner,
    wallet,
    source,
    refetch: refetchLines,
  } = useCreditData();

  const serverBacked = usesLedgerHistory(source);
  const serverPage = useServerTransactions(serverBacked && owner ? source : null, owner, query);

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

  const serverTransactions = useMemo(
    () => serverPage.rows.map((row) => decorateTransaction(row, lines)),
    [lines, serverPage.rows],
  );

  if (serverBacked) {
    return {
      status: owner && serverPage.status === 'idle' ? 'loading' : serverPage.status,
      transactions: serverTransactions,
      nextCursor: serverPage.nextCursor,
      error: serverPage.error,
      refetch: async () => {
        const rows = await serverPage.load();
        return rows.map((row) => decorateTransaction(row, lines));
      },
      lastUpdatedAt: serverPage.lastUpdatedAt,
      owner,
      wallet,
      serverPaged: true,
    };
  }

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
    serverPaged: false,
  };
}
