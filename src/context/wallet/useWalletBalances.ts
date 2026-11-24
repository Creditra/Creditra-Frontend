import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus, WalletInfo } from '../../types/wallet';
import { getCreditNetworkConfig } from '../../config/creditNetwork';
import { useOnline } from '../../hooks/useOnline';
import {
  subscribeToAccount,
  type HorizonAccountBalance,
  type HorizonStreamStatus,
} from '../../services/horizonStream';
import { walletIdentityKey } from './useWalletConnection';

export interface BalanceInfo {
  asset: string; // e.g., 'XLM' or asset_code
  balance: string;
  issuer?: string;
}

const BALANCE_FETCH_TIMEOUT_MS = 10_000;

export interface UseWalletBalancesOptions {
  wallet: WalletInfo | null;
  status: ConnectionStatus;
}

export interface UseWalletBalancesResult {
  balances: BalanceInfo[] | null;
  lastUpdated: Date | null;
  streamStatus: HorizonStreamStatus;
  refreshBalance: () => Promise<BalanceInfo[] | null>;
  setDropdownOpen: (open: boolean) => void;
}

export function useWalletBalances({
  wallet,
  status,
}: UseWalletBalancesOptions): UseWalletBalancesResult {
  const [balances, setBalances] = useState<BalanceInfo[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [streamStatus, setStreamStatus] = useState<HorizonStreamStatus>('live');
  const { isOnline } = useOnline();
  const balanceAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Tracks the identity `balances`/`lastUpdated` currently belong to, so the
  // invalidation effect below can tell "the wallet changed" apart from
  // "the wallet object was replaced with an equivalent one".
  const balancesIdentityRef = useRef<string | null>(null);

  // Cache invalidation on account / network switch (#961)
  useEffect(() => {
    const currentKey = walletIdentityKey(wallet);
    if (balancesIdentityRef.current === currentKey) return;

    // Abort any in-flight balance request for the previous wallet identity.
    balanceAbortControllerRef.current?.abort();
    balanceAbortControllerRef.current = null;

    if (balancesIdentityRef.current !== null) {
      console.warn('[WalletContext] Wallet identity changed — clearing cached balances.');
    }
    balancesIdentityRef.current = currentKey;
    setBalances(null);
    setLastUpdated(null);
  }, [wallet]);

  const fetchBalances = useCallback(async (): Promise<BalanceInfo[] | null> => {
    if (!wallet?.publicKey) return null;

    // Abort any previous in-flight balance request before starting a new one.
    balanceAbortControllerRef.current?.abort();
    const controller = new AbortController();
    balanceAbortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, BALANCE_FETCH_TIMEOUT_MS);

    const fetchIdentity = walletIdentityKey(wallet);
    try {
      const { horizonUrl } = getCreditNetworkConfig();
      const response = await fetch(`${horizonUrl}/accounts/${wallet.publicKey}`, {
        signal: controller.signal,
      });

      if (!isMountedRef.current || balancesIdentityRef.current !== fetchIdentity) {
        console.warn('[WalletContext] Discarding balance response for a stale wallet identity.');
        return null;
      }

      if (response.status === 404) {
        const emptyBalances: BalanceInfo[] = [];
        setBalances(emptyBalances);
        setLastUpdated(new Date());
        return emptyBalances;
      }

      if (!response.ok) {
        console.error(
          `[WalletContext] Failed to fetch balances: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
        );
        return null;
      }

      const data = await response.json();

      if (!isMountedRef.current || balancesIdentityRef.current !== fetchIdentity) {
        console.warn('[WalletContext] Discarding balance response for a stale wallet identity.');
        return null;
      }

      if (!data || !Array.isArray(data.balances)) {
        console.error('[WalletContext] Failed to fetch balances: invalid response payload.');
        return null;
      }

      const bal: BalanceInfo[] = data.balances.map(
        (b: {
          asset_type: string;
          asset_code?: string;
          asset_issuer?: string;
          balance: string;
        }) => ({
          asset: b.asset_type === 'native' ? 'XLM' : b.asset_code ?? '',
          balance: b.balance,
          ...(b.asset_issuer ? { issuer: b.asset_issuer } : {}),
        }),
      );
      setBalances(bal);
      setLastUpdated(new Date());
      return bal;
    } catch (e) {
      if (
        controller.signal.aborted ||
        (e instanceof Error && e.name === 'AbortError')
      ) {
        return null;
      }
      console.error('Failed to fetch balances', e);
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (balanceAbortControllerRef.current === controller) {
        balanceAbortControllerRef.current = null;
      }
    }
  }, [wallet]);

  const refreshBalance = useCallback(() => fetchBalances(), [fetchBalances]);

  const setDropdownOpen = useCallback((_open: boolean) => {
    // Balance updates are now driven by the Horizon SSE stream (with polling fallback).
  }, []);

  // Subscribe to the Horizon SSE account stream while connected and online.
  // Automatically tears down on disconnect, account/network switch, offline, or unmount.
  useEffect(() => {
    if (status !== 'connected' || !wallet?.publicKey || !isOnline) {
      return;
    }

    const subscribedIdentity = walletIdentityKey(wallet);
    const unsubscribe = subscribeToAccount(wallet.publicKey, {
      onUpdate: (account) => {
        if (!isMountedRef.current || balancesIdentityRef.current !== subscribedIdentity) {
          return;
        }
        if (!Array.isArray(account.balances)) {
          return;
        }
        const bal: BalanceInfo[] = account.balances.map((b: HorizonAccountBalance) => ({
          asset: b.asset_type === 'native' ? 'XLM' : b.asset_code ?? '',
          balance: b.balance,
          ...(b.asset_issuer ? { issuer: b.asset_issuer } : {}),
        }));
        setBalances(bal);
        setLastUpdated(new Date());
      },
      onStatus: (nextStatus) => {
        if (!isMountedRef.current) return;
        setStreamStatus(nextStatus);
      },
      onPoll: fetchBalances,
    });

    return () => {
      unsubscribe();
    };
  }, [status, wallet, isOnline, fetchBalances]);

  // Clean up abort controller on unmount.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      balanceAbortControllerRef.current?.abort();
      balanceAbortControllerRef.current = null;
    };
  }, []);

  return {
    balances,
    lastUpdated,
    streamStatus,
    refreshBalance,
    setDropdownOpen,
  };
}
