import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletInfo, ConnectionStatus, WalletError, WalletType } from '../../types/wallet';
import { WalletConnectError } from '../../types/wallet';
import {
  connectWallet,
  disconnectWallet,
  saveWalletPreference,
  getStoredWallet,
  recordRecentWallet,
  isWalletRemembered,
  setWalletRemembered,
  classifyWalletError,
} from '../../utils/wallet';
import { isValidAccountId } from '../../utils/strkey';

/**
 * How long (ms) to wait for a reconnect attempt before showing the
 * "taking too long" banner.  8 s covers most slow-loading extensions
 * without feeling laggy on fast connections (typical connect < 1 s).
 *
 * Exposed so tests can override it without patching timers globally.
 */
export const RECONNECT_TIMEOUT_MS = 8_000;

/**
 * Stable identity string for a `WalletInfo`, used to detect account or
 * network switches. `null` wallet → `null` key (disconnected has no identity
 * to compare against). Two different wallet *types* connected to the same
 * public key are treated as different identities on purpose — different
 * extensions could report the same address in different network contexts.
 */
export function walletIdentityKey(wallet: WalletInfo | null): string | null {
  if (!wallet) return null;
  return `${wallet.type}:${wallet.publicKey}:${wallet.network}`;
}

const requireValidWalletInfo = (wallet: WalletInfo): WalletInfo => {
  if (!isValidAccountId(wallet.publicKey)) {
    throw {
      type: 'connection_failed',
      message: 'Your wallet returned an invalid account address',
    } as WalletError;
  }
  return wallet;
};

/** Optional second-arg bag for `connect()`. */
export interface ConnectOptions {
  /**
   * When `true`, mark this wallet as the user's "remembered" one.  The
   * provider will auto-reconnect to it on subsequent page loads and the
   * wallet dropdown exposes a "Forget choice" affordance so the user
   * can revoke that decision.  Defaults to `false` to keep the behaviour
   * opt-in: a passive click that does not pass this flag will connect
   * just for the current session, with no persisted preference.
   */
  remember?: boolean;
}

/** Result of a connect attempt. */
export type ConnectResult =
  | { ok: true; wallet: WalletInfo }
  | { ok: false; error: WalletConnectError };

export interface UseWalletConnectionOptions {
  timeoutMs: number;
  initialWallet?: WalletInfo | null;
  startSessionTimers: () => void;
  clearSessionTimers: () => void;
  resetSessionWarning: () => void;
}

export function useWalletConnection({
  timeoutMs,
  initialWallet,
  startSessionTimers,
  clearSessionTimers,
  resetSessionWarning,
}: UseWalletConnectionOptions) {
  const [wallet, setWallet] = useState<WalletInfo | null>(() => initialWallet ?? null);
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    initialWallet ? 'connected' : 'disconnected',
  );
  const [error, setError] = useState<WalletError | null>(null);
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false);
  // Initialised from `localStorage` via the safe wrapper so the very first
  // render reflects whether the user opted in on a previous session.
  const [isRemembered, setIsRemembered] = useState<boolean>(() => isWalletRemembered());

  useEffect(() => {
    if (initialWallet === undefined) return;
    setWallet(initialWallet);
    setStatus(initialWallet ? 'connected' : 'disconnected');
  }, [initialWallet]);

  // Ref so the timeout cleanup in `runReconnect` closes over a stable reference.
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Attempt token tracking: ensures superseded async connections, reconnects,
  // or identity updates never apply stale state or overwrite storage.
  const attemptRef = useRef(0);

  /**
   * Clear any pending reconnect timeout timer.
   * Safe to call even when no timer is active.
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Expire the session when the session timer fires — clears persisted wallet
   * type and "remember" flag as well as in-memory state.
   */
  const expireSession = useCallback(() => {
    disconnectWallet();
    setIsRemembered(false);
    setWallet(null);
    setStatus('disconnected');
  }, []);

  const runReconnect = useCallback(
    async (type: WalletType) => {
      const id = ++attemptRef.current;
      clearReconnectTimeout();
      setStatus('reconnecting');
      setError(null);
      setReconnectTimedOut(false);

      // Start the "taking too long" timer.
      reconnectTimeoutRef.current = setTimeout(() => {
        if (id !== attemptRef.current) return;
        setReconnectTimedOut(true);
      }, timeoutMs);

      try {
        const walletInfo = requireValidWalletInfo(await connectWallet(type));
        clearReconnectTimeout();
        setWallet(walletInfo);
        setStatus('connected');
        setReconnectTimedOut(false);
        saveWalletPreference(walletInfo);
        recordRecentWallet(type);
        setIsRemembered(true);
        startSessionTimers();
      } catch (err) {
        if (id !== attemptRef.current) return;
        clearReconnectTimeout();
        setReconnectTimedOut(false);
        clearSessionTimers();
        resetSessionWarning();
        setError(err as WalletError);
        setStatus('error');
        setWallet(null);
      }
    },
    [clearReconnectTimeout, timeoutMs, startSessionTimers, clearSessionTimers, resetSessionWarning],
  );

  // Auto-reconnect on mount
  useEffect(() => {
    const stored = getStoredWallet();
    const remembered = isWalletRemembered();
    if (!stored || !remembered) return;

    runReconnect(stored.type);

    return () => {
      ++attemptRef.current;
      clearReconnectTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    async (type: WalletType, options?: ConnectOptions): Promise<ConnectResult> => {
      clearReconnectTimeout();
      setStatus('connecting');
      setError(null);
      setReconnectTimedOut(false);

      // Default to NOT remembering — the choice must be opt-in.
      const shouldRemember = options?.remember === true;

      try {
        const walletInfo = requireValidWalletInfo(await connectWallet(type));
        setWallet(walletInfo);
        setStatus('connected');
        saveWalletPreference(walletInfo);
        recordRecentWallet(type);
        setWalletRemembered(shouldRemember);
        setIsRemembered(shouldRemember);
        startSessionTimers();
        return { ok: true, wallet: walletInfo };
      } catch (err) {
        const walletError =
          err instanceof WalletConnectError ? err : classifyWalletError(err);

        setError(walletError);
        setStatus('error');
        setWallet(null);
        clearSessionTimers();
        resetSessionWarning();
        return { ok: false, error: walletError };
      }
    },
    [clearReconnectTimeout, startSessionTimers, clearSessionTimers, resetSessionWarning],
  );

  const disconnect = useCallback(() => {
    ++attemptRef.current;
    clearReconnectTimeout();
    disconnectWallet();
    clearSessionTimers();
    setWallet(null);
    setStatus('disconnected');
    setError(null);
    setReconnectTimedOut(false);
    resetSessionWarning();
    setIsRemembered(false);
  }, [clearReconnectTimeout, clearSessionTimers, resetSessionWarning]);

  const forgetRememberedChoice = useCallback(() => {
    ++attemptRef.current;
    setWalletRemembered(false);
    setIsRemembered(false);
  }, []);

  const dismissReconnectBanner = useCallback(() => {
    setReconnectTimedOut(false);
  }, []);

  const retryReconnect = useCallback(() => {
    const stored = getStoredWallet();
    if (!stored) return;
    runReconnect(stored.type);
  }, [runReconnect]);

  const stayConnected = useCallback(async () => {
    const stored = getStoredWallet();
    if (!stored || !wallet) return;
    const id = ++attemptRef.current;
    try {
      const walletInfo = requireValidWalletInfo(await connectWallet(stored.type));
      setWallet(walletInfo);
      setStatus('connected');
      saveWalletPreference(walletInfo);
      startSessionTimers();
    } catch (err) {
      if (id !== attemptRef.current) return;
      clearSessionTimers();
      resetSessionWarning();
      setError(err as WalletError);
      setStatus('error');
      setWallet(null);
    }
  }, [wallet, startSessionTimers, clearSessionTimers, resetSessionWarning]);

  const clearError = useCallback(() => setError(null), []);

  const refreshWalletIdentity = useCallback(async () => {
    if (!wallet || !isValidAccountId(wallet.publicKey)) return;
    try {
      const fresh = await connectWallet(wallet.type);
      if (!isValidAccountId(fresh.publicKey)) return;
      if (walletIdentityKey(fresh) !== walletIdentityKey(wallet)) {
        setWallet(fresh);
      }
    } catch (e) {
      console.error('Failed to refresh wallet identity', e);
    }
  }, [wallet]);

  return {
    wallet,
    status,
    error,
    reconnectTimedOut,
    isRemembered,
    connect,
    disconnect,
    forgetRememberedChoice,
    clearError,
    dismissReconnectBanner,
    retryReconnect,
    stayConnected,
    refreshWalletIdentity,
    expireSession,
  };
}
