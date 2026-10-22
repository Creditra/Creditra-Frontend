import { useState, useCallback, useRef, useEffect } from 'react';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine, Transaction } from '../types/creditLine';
import { createCreditDataSource } from '../services/credit';

export interface UseCreditLinesResult {
  lines: CreditLine[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: Error | null;
  lastUpdatedAt: Date;
  refetch: () => Promise<CreditLine[]>;
}

export interface UseCreditTransactionsResult {
  transactions: (Transaction & { lineName: string; lineId: string })[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: Error | null;
  lastUpdatedAt: Date;
  refetch: () => Promise<(Transaction & { lineName: string; lineId: string })[]>;
}

let globalCreditLines: CreditLine[] = [...MOCK_CREDIT_LINES];
let globalLinesUpdatedAt: Date = new Date();
let mockRefetchError: Error | null = null;
const listeners = new Set<() => void>();

export function setMockRefetchError(err: Error | null) {
  mockRefetchError = err;
}

export function setGlobalCreditLines(newLines: CreditLine[]) {
  globalCreditLines = [...newLines];
  listeners.forEach((fn) => fn());
}

export function getGlobalCreditLines(): CreditLine[] {
  return globalCreditLines;
}

export function resetGlobalCreditLines() {
  globalCreditLines = [...MOCK_CREDIT_LINES];
  globalLinesUpdatedAt = new Date();
  mockRefetchError = null;
  listeners.forEach((fn) => fn());
}

export function useCreditLines(): UseCreditLinesResult {
  const [lines, setLines] = useState<CreditLine[]>(() => [...globalCreditLines]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('success');
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(() => globalLinesUpdatedAt);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const onChange = () => {
      setLines([...globalCreditLines]);
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const refetch = useCallback(async (): Promise<CreditLine[]> => {
    if (inFlightRef.current) {
      return globalCreditLines;
    }
    inFlightRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      if (
        typeof import.meta !== 'undefined' &&
        import.meta.env?.VITE_CREDIT_DATA_SOURCE === 'soroban'
      ) {
        const dataSource = createCreditDataSource('soroban');
        const borrower = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
        const fetchedLines = await dataSource.listCreditLines(borrower);
        setGlobalCreditLines(fetchedLines);
        setLines(fetchedLines);
        const now = new Date();
        globalLinesUpdatedAt = now;
        setLastUpdatedAt(now);
        setStatus('success');
        return fetchedLines;
      }
      await new Promise((r) => setTimeout(r, 20));
      if (mockRefetchError) {
        throw mockRefetchError;
      }
      setLines([...globalCreditLines]);
      const now = new Date();
      globalLinesUpdatedAt = now;
      setLastUpdatedAt(now);
      setStatus('success');
      return globalCreditLines;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setStatus('error');
      throw e;
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  return { lines, status, error, lastUpdatedAt, refetch };
}

export function useCreditTransactions(): UseCreditTransactionsResult {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('success');
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(() => globalLinesUpdatedAt);
  const inFlightRef = useRef(false);

  const deriveTransactions = useCallback(() => {
    const all: (Transaction & { lineName: string; lineId: string })[] = [];
    globalCreditLines.forEach((cl) => {
      cl.transactions?.forEach((tx) => {
        all.push({ ...tx, lineName: cl.name, lineId: cl.id });
      });
    });
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return all.slice(0, 5);
  }, []);

  const [transactions, setTransactions] = useState(() => deriveTransactions());

  useEffect(() => {
    const onChange = () => {
      setTransactions(deriveTransactions());
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [deriveTransactions]);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) {
      return transactions;
    }
    inFlightRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 20));
      if (mockRefetchError) {
        throw mockRefetchError;
      }
      const updated = deriveTransactions();
      setTransactions(updated);
      const now = new Date();
      setLastUpdatedAt(now);
      setStatus('success');
      return updated;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setStatus('error');
      throw e;
    } finally {
      inFlightRef.current = false;
    }
  }, [deriveTransactions, transactions]);

  return { transactions, status, error, lastUpdatedAt, refetch };
}
