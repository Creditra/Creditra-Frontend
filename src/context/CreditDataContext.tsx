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
import { createCreditDataSource } from '../services/credit';
import type { CreditDataSource } from '../services/credit/CreditDataSource';
import type { CreditLine } from '../types/creditLine';
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
}

const CreditDataContext = createContext<CreditDataState | null>(null);

interface CreditDataProviderProps {
  children: ReactNode;
  source?: CreditDataSource;
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

  const refetch = useCallback(() => load(), [load]);
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
      }}
    >
      {children}
    </CreditDataContext.Provider>
  );
}

export function useCreditData(): CreditDataState {
  const value = useContext(CreditDataContext);
  if (!value) throw new Error('Credit data hooks must be used within CreditDataProvider');
  return value;
}
