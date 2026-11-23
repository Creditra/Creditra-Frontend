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
  getAccounts,
  getLastAccount,
  saveLastAccount,
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

/**
 * Discover every account the wallet exposes and make sure the connected key is
 * present. Returns a de-duplicated list with the extension's active key first.
 *
 * `getAccounts` is feature-detected and failure-tolerant: older extensions
 * (and test doubles that stub only the connect surface) simply yield the single
 * connected key.
 */
async function discoverAccounts(type: WalletType, activePublicKey: string): Promise<string[]> {
  let discovered: string[] = [];
  if (typeof getAccounts === 'function') {
    try {
      discovered = await getAccounts(type);
    } catch {
      discovered = [];
    }
  }
  const ordered = [activePublicKey, ...discovered];
  return ordered.filter(
    (key, index) => isValidAccountId(key) && ordered.indexOf(key) === index,
  );
}

/**
 * Pick the account to activate. An explicitly remembered choice wins when the
 * wallet still exposes it; otherwise the extension's active key is used.
 * `keepCurrent` lets a re-ping retain the account the user already selected.
 */
function resolveActiveKey(
  type: WalletType,
  accounts: string[],
  extensionKey: string,
  keepCurrent?: string | null,
): string {
  if (keepCurrent && accounts.includes(keepCurrent)) return keepCurrent;
  if (typeof getLastAccount === 'function') {
    const remembered = getLastAccount(type);
    if (remembered && accounts.includes(remembered)) return remembered;
  }
  return extensionKey;
}

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
  const [accounts, setAccounts] = useState<string[]>(() =>
    initialWallet ? [initialWallet.publicKey] : [],
  );
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
    setAccounts(initialWallet ? [initialWallet.publicKey] : []);
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
    setAccounts([]);
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
        const discovered = await discoverAccounts(type, walletInfo.publicKey);
        const activeKey = resolveActiveKey(type, discovered, walletInfo.publicKey, wallet?.publicKey);
        const activeWallet =
          activeKey === walletInfo.publicKey ? walletInfo : { ...walletInfo, publicKey: activeKey };
        clearReconnectTimeout();
        setAccounts(discovered);
        setWallet(activeWallet);
        setStatus('connected');
        setReconnectTimedOut(false);
        saveWalletPreference(activeWallet);
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
        setAccounts([]);
      }
    },
    [clearReconnectTimeout, timeoutMs, startSessionTimers, clearSessionTimers, resetSessionWarning, wallet],
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
        const discovered = await discoverAccounts(type, walletInfo.publicKey);
        const activeKey = resolveActiveKey(type, discovered, walletInfo.publicKey);
        const activeWallet =
          activeKey === walletInfo.publicKey ? walletInfo : { ...walletInfo, publicKey: activeKey };
        setAccounts(discovered);
        setWallet(activeWallet);
        setStatus('connected');
        saveWalletPreference(activeWallet);
        recordRecentWallet(type);
        setWalletRemembered(shouldRemember);
        setIsRemembered(shouldRemember);
        startSessionTimers();
        return { ok: true, wallet: activeWallet };
      } catch (err) {
        const walletError =
          err instanceof WalletConnectError ? err : classifyWalletError(err);

        setError(walletError);
        setStatus('error');
        setWallet(null);
        setAccounts([]);
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
    setAccounts([]);
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
      const discovered = await discoverAccounts(stored.type, walletInfo.publicKey);
      const activeKey = resolveActiveKey(
        stored.type,
        discovered,
        walletInfo.publicKey,
        wallet.publicKey,
      );
      const activeWallet =
        activeKey === walletInfo.publicKey ? walletInfo : { ...walletInfo, publicKey: activeKey };
      setAccounts(discovered);
      setWallet(activeWallet);
      setStatus('connected');
      saveWalletPreference(activeWallet);
      startSessionTimers();
    } catch (err) {
      if (id !== attemptRef.current) return;
      clearSessionTimers();
      resetSessionWarning();
      setError(err as WalletError);
      setStatus('error');
      setWallet(null);
      setAccounts([]);
    }
  }, [wallet, startSessionTimers, clearSessionTimers, resetSessionWarning]);

  const clearError = useCallback(() => setError(null), []);

  const refreshWalletIdentity = useCallback(async () => {
    if (!wallet || !isValidAccountId(wallet.publicKey)) return;
    try {
      const fresh = await connectWallet(wallet.type);
      if (!isValidAccountId(fresh.publicKey)) return;
      const discovered = await discoverAccounts(wallet.type, fresh.publicKey);
      const activeKey = resolveActiveKey(
        wallet.type,
        discovered,
        fresh.publicKey,
        wallet.publicKey,
      );
      const next = activeKey === fresh.publicKey ? fresh : { ...fresh, publicKey: activeKey };
      setAccounts(discovered);
      if (walletIdentityKey(next) !== walletIdentityKey(wallet)) {
        setWallet(next);
      }
    } catch (e) {
      console.error('Failed to refresh wallet identity', e);
    }
  }, [wallet]);

  /**
   * Activate another account exposed by the current wallet. Updating `wallet`
   * is enough to re-scope everything derived from the identity: the
   * cache-invalidation effect clears `balances`, the Horizon stream
   * re-subscribes, and per-wallet drafts key off `walletIdentityKey`.
   */
  const switchAccount = useCallback(
    (publicKey: string) => {
      if (!wallet || !isValidAccountId(publicKey)) return;
      if (wallet.publicKey === publicKey || !accounts.includes(publicKey)) return;
      setWallet({ ...wallet, publicKey });
      saveLastAccount(wallet.type, publicKey);
    },
    [wallet, accounts],
  );

  return {
    wallet,
    accounts,
    switchAccount,
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
