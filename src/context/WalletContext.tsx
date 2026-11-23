/**
 * WalletContext
 *
 * App-wide wallet state provider composed from focused internal hooks:
 * - `useWalletConnection`: wallet connect, auto-reconnect, disconnect, and identity refresh
 * - `useWalletBalances`: Horizon balance fetching, cache invalidation, and SSE streaming
 * - `useSessionTimeout`: session-lifetime warning and expiration timers
 */

import { createContext, useContext, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { WalletInfo, ConnectionStatus, WalletError, WalletType } from '../types/wallet';
import type { HorizonStreamStatus } from '../services/horizonStream';
import {
  useSessionTimeout,
  SESSION_TIMEOUT_MS,
  SESSION_WARN_BEFORE_MS,
} from './wallet/useSessionTimeout';
import {
  useWalletConnection,
  RECONNECT_TIMEOUT_MS,
  walletIdentityKey,
  type ConnectOptions,
  type ConnectResult,
} from './wallet/useWalletConnection';
import { useWalletBalances, type BalanceInfo } from './wallet/useWalletBalances';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  RECONNECT_TIMEOUT_MS,
  SESSION_TIMEOUT_MS,
  SESSION_WARN_BEFORE_MS,
  walletIdentityKey,
};
export type { BalanceInfo, ConnectOptions, ConnectResult };

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletContextType {
  /** The currently connected wallet, or `null` when disconnected. */
  wallet: WalletInfo | null;
  /** Coarse connection-lifecycle state. UI consumers branch on this for spinners and badges. */
  status: ConnectionStatus;
  /**
   * Discriminated wallet-error union, populated only when `status === 'error'`.
   * Branch on `error.type` to render specific recovery copy.
   */
  error: WalletError | null;
  /**
   * `true` when an auto-reconnect is in flight and has exceeded
   * `RECONNECT_TIMEOUT_MS`.  The `WalletReconnectBanner` subscribes to
   * this to show the "taking longer than expected" affordance.
   */
  reconnectTimedOut: boolean;
  /**
   * Mirror of the opt-in "remember my choice" flag in `localStorage`.
   * `true` only when the user has explicitly opted in on their most
   * recent connection.  Drives the `WalletConnectionModal` and the
   * `Forget` affordance in the wallet dropdown.
   */
  isRemembered: boolean;
  /**
   * Becomes `true` SESSION_WARN_BEFORE_MS before the session expires.
   * Consumed by SessionTimeoutBanner. Cleared by stayConnected() / disconnect().
   */
  sessionTimeoutWarning: boolean;
  /**
   * Open a connection to the given wallet. Updates `status` to
   * `connecting`, then either `connected` (on success) or `error`.
   */
  connect: (type: WalletType, options?: ConnectOptions) => Promise<ConnectResult>;
  /** Forget the current wallet, clear preference, return to disconnected state. */
  disconnect: () => void;
  /**
   * Clear only the "remember my choice" flag without disconnecting the
   * wallet for the current session.
   */
  forgetRememberedChoice: () => void;
  /** Clear an error without changing status — used by retry affordances. */
  clearError: () => void;
  /**
   * Dismiss the reconnect-timeout banner without aborting the in-flight
   * reconnect.  The banner will not reappear until the next page load.
   */
  dismissReconnectBanner: () => void;
  /**
   * Re-run the auto-reconnect using the stored wallet type.  No-op when
   * no stored preference exists.  Resets `reconnectTimedOut` and starts
   * a fresh timeout window.
   */
  retryReconnect: () => void;
  /**
   * Re-ping the wallet to verify liveness and reset the session clock.
   * On success: `sessionTimeoutWarning` clears and the full session timer restarts.
   * On failure: status transitions to `'error'`.
   */
  stayConnected: () => Promise<void>;
  refreshBalance: () => Promise<BalanceInfo[] | null>;
  /**
   * Re-derive the wallet's current `publicKey`/`network` from the extension
   * without a `connecting`/`reconnecting` UI transition.
   */
  refreshWalletIdentity: () => Promise<void>;
  setDropdownOpen: (open: boolean) => void;
  balances: BalanceInfo[] | null;
  lastUpdated: Date | null;
  /** Live Horizon SSE stream state: `'live' | 'reconnecting' | 'polling'`. */
  streamStatus: HorizonStreamStatus;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * App-wide wallet provider.
 *
 * Mount this once, near the top of the tree (see `src/App.tsx`), above any
 * component that calls `useWallet()`.
 *
 * @param timeoutMs - Override the reconnect timeout (used in tests).
 */
export const WalletProvider = ({
  children,
  timeoutMs = RECONNECT_TIMEOUT_MS,
  sessionTimeoutMs = SESSION_TIMEOUT_MS,
  initialWallet,
}: {
  children: ReactNode;
  /** Override the reconnect timeout duration (ms). Defaults to RECONNECT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Override the session lifetime (ms). Defaults to SESSION_TIMEOUT_MS. */
  sessionTimeoutMs?: number;
  /** Initial wallet state for deterministic provider tests. */
  initialWallet?: WalletInfo | null;
}) => {
  const onExpireRef = useRef<() => void>(() => {});

  const {
    sessionTimeoutWarning,
    startSessionTimers,
    clearSessionTimers,
    resetSessionWarning,
  } = useSessionTimeout({
    sessionTimeoutMs,
    onExpire: () => onExpireRef.current(),
  });

  const {
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
  } = useWalletConnection({
    timeoutMs,
    initialWallet,
    startSessionTimers,
    clearSessionTimers,
    resetSessionWarning,
  });

  onExpireRef.current = expireSession;

  const {
    balances,
    lastUpdated,
    streamStatus,
    refreshBalance,
    setDropdownOpen,
  } = useWalletBalances({ wallet, status });

  const value = useMemo<WalletContextType>(
    () => ({
      wallet,
      status,
      error,
      reconnectTimedOut,
      isRemembered,
      sessionTimeoutWarning,
      connect,
      disconnect,
      forgetRememberedChoice,
      clearError,
      dismissReconnectBanner,
      retryReconnect,
      stayConnected,
      balances,
      lastUpdated,
      streamStatus,
      refreshBalance,
      refreshWalletIdentity,
      setDropdownOpen,
    }),
    [
      wallet,
      status,
      error,
      reconnectTimedOut,
      isRemembered,
      sessionTimeoutWarning,
      connect,
      disconnect,
      forgetRememberedChoice,
      clearError,
      dismissReconnectBanner,
      retryReconnect,
      stayConnected,
      balances,
      lastUpdated,
      streamStatus,
      refreshBalance,
      refreshWalletIdentity,
      setDropdownOpen,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Read the wallet context inside a `WalletProvider` subtree.
 *
 * Throws if called outside the provider — this is intentional, since a
 * silent `undefined` would cascade into confusing downstream errors
 * (e.g. "cannot read property 'wallet' of undefined") far from the
 * actual misuse.
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
