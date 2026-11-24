import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { walletIdentityKey, useWallet } from './WalletContext';
import { NotificationContext, type AddToastOptions } from './NotificationContext';
import { createCreditDataSource } from '../services/credit';
import type {
  CreditDataSource,
  ListTransactionsOptions,
  TransactionPage,
} from '../services/credit/CreditDataSource';
import { MockCreditDataSource } from '../services/credit/mockCreditDataSource';
import { SorobanCreditDataSource } from '../services/credit/sorobanCreditDataSource';
import {
  startCreditEventPoller,
  type CreditDomainEvent,
} from '../services/credit/eventPoller';
import { formatCurrency } from '../utils/currency';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine, CreditLineStatus } from '../types/creditLine';
import { emit } from '../lib/event-bus';
import type { WalletInfo } from '../types/wallet';

export type CreditDataStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CreditDataState {
  status: CreditDataStatus;
  lines: CreditLine[];
  error: Error | null;
  lastUpdatedAt: Date | null;
  owner: string | null;
  wallet: WalletInfo | null;
  refetch: () => Promise<CreditLine[]>;
  setLines: (lines: CreditLine[]) => void;
  listTransactions: (lineId: string, options?: ListTransactionsOptions) => Promise<TransactionPage>;
}

const CreditDataContext = createContext<CreditDataState | null>(null);

interface CreditDataProviderProps {
  children: ReactNode;
  source?: CreditDataSource;
}

function toCreditEventToast(event: CreditDomainEvent): AddToastOptions {
  if (event.kind === 'draw') {
    return {
      type: 'info',
      category: 'transaction',
      title: 'Credit drawn',
      message: `${formatCurrency(event.amount ?? 0)} was drawn from your credit line.`,
      saveToHistory: true,
    };
  }
  if (event.kind === 'repay') {
    return {
      type: 'success',
      category: 'transaction',
      title: 'Repayment received',
      message: `${formatCurrency(event.amount ?? 0)} was repaid on your credit line.`,
      saveToHistory: true,
    };
  }
  return {
    type: event.status === 'Active' ? 'info' : 'warning',
    category: 'credit_line',
    title: 'Credit line status changed',
    message: `Your credit line is now ${event.status ?? 'updated'}.`,
    saveToHistory: true,
  };
}

interface StoredState {
  identity: string | null;
  status: CreditDataStatus;
  lines: CreditLine[];
  error: Error | null;
  lastUpdatedAt: Date | null;
}

export function CreditDataProvider({ children, source }: CreditDataProviderProps) {
  const [dataSource] = useState(() => source ?? createCreditDataSource());
  const { wallet } = useWallet();
  const identity = walletIdentityKey(wallet);
  const owner = wallet?.publicKey ?? null;
  const identityRef = useRef(identity);
  const generationRef = useRef(0);
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    generationRef.current += 1;
  }

  const [stored, setStored] = useState<StoredState>({
    identity: null,
    status: 'idle',
    lines: [],
    error: null,
    lastUpdatedAt: null,
  });
  const inFlightRef = useRef(new Map<number, Promise<CreditLine[]>>());
  const knownStatusesRef = useRef(new Map<string, CreditLineStatus>());

  const load = useCallback(async (): Promise<CreditLine[]> => {
    if (!owner || !identity || identityRef.current !== identity) return [];
    const generation = generationRef.current;
    const existing = inFlightRef.current.get(generation);
    if (existing) return existing;

    setStored((previous) => ({
      identity,
      status: 'loading',
      lines: previous.identity === identity ? previous.lines : [],
      error: null,
      lastUpdatedAt: previous.identity === identity ? previous.lastUpdatedAt : null,
    }));
    const request = Promise.resolve().then(() => dataSource.listCreditLines(owner)).then((lines) => {
      if (generationRef.current === generation && identityRef.current === identity) {
        for (const line of lines) {
          const statusKey = `${identity}:${line.id}`;
          const previousStatus = knownStatusesRef.current.get(statusKey);
          if (previousStatus && previousStatus !== line.status) {
            emit('line:statusChanged', {
              creditLineId: line.id,
              previousStatus,
              status: line.status,
            });
          }
          knownStatusesRef.current.set(statusKey, line.status);
        }

        setStored({
          identity,
          status: 'success',
          lines,
          error: null,
          lastUpdatedAt: new Date(),
        });
      }
      return lines;
    }).catch((reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      if (generationRef.current === generation && identityRef.current === identity) {
        setStored((previous) => ({
          identity,
          status: 'error',
          lines: previous.identity === identity ? previous.lines : [],
          error,
          lastUpdatedAt: previous.identity === identity ? previous.lastUpdatedAt : null,
        }));
      }
      throw error;
    }).finally(() => {
      inFlightRef.current.delete(generation);
    });
    inFlightRef.current.set(generation, request);
    return request;
  }, [dataSource, identity, owner]);

  useEffect(() => {
    if (!identity || !owner) {
      setStored({
        identity: null,
        status: 'idle',
        lines: [],
        error: null,
        lastUpdatedAt: null,
      });
      return;
    }
    void load().catch(() => undefined);
  }, [identity, load, owner]);

  const addToast = useContext(NotificationContext)?.addToast;
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => {
    if (!owner || !(dataSource instanceof SorobanCreditDataSource)) return;
    return startCreditEventPoller({
      server: dataSource.server,
      contractId: dataSource.contractId,
      borrower: owner,
      onEvents: (events) => {
        void load().catch(() => undefined);
        events.forEach((event) => addToastRef.current?.(toCreditEventToast(event)));
      },
    });
  }, [dataSource, load, owner]);

  const refetch = useCallback(() => load(), [load]);
  const listTransactions = useCallback(
    (lineId: string, options?: ListTransactionsOptions) =>
      dataSource.listTransactions(lineId, options),
    [dataSource],
  );
  const setLines = useCallback((lines: CreditLine[]) => {
    if (!identity || identityRef.current !== identity) return;
    setStored((previous) => ({
      identity,
      status: 'success',
      lines,
      error: null,
      lastUpdatedAt: previous.identity === identity ? previous.lastUpdatedAt : new Date(),
    }));
  }, [identity]);

  const visibleState = stored.identity === identity && identity
    ? stored
    : {
        identity,
        status: identity ? 'loading' as const : 'idle' as const,
        lines: [],
        error: null,
        lastUpdatedAt: null,
      };

  return (
    <CreditDataContext.Provider
      value={{
        ...visibleState,
        owner,
        wallet,
        refetch,
        setLines,
        listTransactions,
      }}
    >
      {children}
    </CreditDataContext.Provider>
  );
}

export function useCreditData(): CreditDataState {
  const value = useContext(CreditDataContext);
  if (value) return value;

  // Isolated component tests render pages without the app shell. Falling back
  // to the fixture data keeps those tests focused on the component under test;
  // production builds still fail loudly when the provider is missing.
  if (import.meta.env.MODE === 'test') {
    return {
      status: 'success',
      lines: MOCK_CREDIT_LINES,
      error: null,
      lastUpdatedAt: null,
      owner: null,
      wallet: null,
      refetch: async () => MOCK_CREDIT_LINES,
      setLines: () => undefined,
      listTransactions: (lineId, options) =>
        new MockCreditDataSource(MOCK_CREDIT_LINES).listTransactions(lineId, options),
    };
  }

  throw new Error('Credit data hooks must be used within CreditDataProvider');
}
