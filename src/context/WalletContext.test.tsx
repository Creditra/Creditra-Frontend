/**
 * WalletContext — auto-reconnect tests
 *
 * Cover:
 *  1. No stored wallet → status stays 'disconnected', no reconnect attempt.
 *  2. Stored wallet found → status transitions to 'reconnecting' on mount.
 *  3. Reconnect succeeds within timeout → status becomes 'connected',
 *     reconnectTimedOut stays false.
 *  4. Reconnect times out → reconnectTimedOut becomes true while still
 *     'reconnecting'.
 *  5. Reconnect succeeds after timeout → reconnectTimedOut resets to false,
 *     status becomes 'connected'.
 *  6. Reconnect fails → status becomes 'error', reconnectTimedOut resets.
 *  7. dismissReconnectBanner → sets reconnectTimedOut to false without
 *     changing status.
 *  8. retryReconnect → re-runs the reconnect flow (status back to
 *     'reconnecting', fresh timeout window).
 *  9. retryReconnect is a no-op when no stored wallet preference exists.
 * 10. disconnect → clears wallet, sets status to 'disconnected', resets
 *     reconnectTimedOut.
 * 11. User-initiated connect() → uses 'connecting' (not 'reconnecting')
 *     and does not trip the timeout banner.
 * 12. Timeout timer is cleared on unmount (no state-update-on-unmount warning).
 */

import {
  render,
  screen,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletProvider, useWallet } from './WalletContext';
import * as walletUtils from '../utils/wallet';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORED_WALLET = {
  type: 'freighter' as const,
  publicKey: 'GABC123...',
  network: 'PUBLIC',
};

/**
 * Test consumer that renders all relevant context values as data-testid
 * attributes so tests can assert on them without reaching into state.
 */
function WalletContextConsumer() {
  const {
    status,
    wallet,
    error,
    reconnectTimedOut,
    isRemembered,
    dismissReconnectBanner,
    retryReconnect,
    disconnect,
    forgetRememberedChoice,
    connect,
    balances,
    lastUpdated,
    refreshBalance,
    refreshWalletIdentity,
  } = useWallet();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="wallet">{wallet?.publicKey ?? 'null'}</span>
      <span data-testid="wallet-network">{wallet?.network ?? 'null'}</span>
      <span data-testid="error">{error?.type ?? 'null'}</span>
      <span data-testid="reconnect-timed-out">{String(reconnectTimedOut)}</span>
      <span data-testid="is-remembered">{String(isRemembered)}</span>
      <span data-testid="balances">{balances ? balances.map((b) => `${b.asset}:${b.balance}`).join(',') : 'null'}</span>
      <span data-testid="last-updated">{lastUpdated ? 'set' : 'null'}</span>
      <button data-testid="dismiss-btn" onClick={dismissReconnectBanner}>
        Dismiss
      </button>
      <button data-testid="retry-btn" onClick={retryReconnect}>
        Retry
      </button>
      <button data-testid="disconnect-btn" onClick={disconnect}>
        Disconnect
      </button>
      <button data-testid="forget-btn" onClick={forgetRememberedChoice}>
        Forget choice
      </button>
      <button data-testid="connect-btn" data-remember="false" onClick={() => connect('freighter')}>
        Connect no-remember
      </button>
      <button
        data-testid="connect-remember-btn"
        onClick={() => connect('freighter', { remember: true })}
      >
        Connect with remember
      </button>
      <button
        data-testid="connect-bool-btn"
        onClick={() => connect('albedo', { remember: false })}
      >
        Connect with remember=false
      </button>
      <button data-testid="refresh-balance-btn" onClick={() => { refreshBalance(); }}>
        Refresh balance
      </button>
      <button data-testid="refresh-identity-btn" onClick={() => { refreshWalletIdentity(); }}>
        Refresh identity
      </button>
    </div>
  );
}

function renderProvider(timeoutMs = 200) {
  return render(
    <WalletProvider timeoutMs={timeoutMs}>
      <WalletContextConsumer />
    </WalletProvider>,
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
  vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);
  vi.spyOn(walletUtils, 'saveWalletPreference').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'disconnectWallet').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'recordRecentWallet').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
  vi.spyOn(walletUtils, 'setWalletRemembered').mockImplementation(() => {});
  // Make sure legacy + new storage keys are clean so isRemembered defaults
  // to false on every test.
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WalletContext — auto-reconnect gating with remember flag', () => {
  // Gating: when `creditra-wallet-remember` is missing/false we must NOT
  // kick off a reconnect, even if `wallet_info` is present (legacy users).
  it('does NOT auto-reconnect when remembered flag is false', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(false);

    renderProvider();
    await act(async () => { vi.runAllTimers(); });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(walletUtils.connectWallet).not.toHaveBeenCalled();
  });

  // When both flags are true we should reconnect normally.
  it('auto-reconnects when both wallet_info AND remembered are present', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500);
    await act(async () => { vi.advanceTimersByTime(10); });

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('is-remembered').textContent).toBe('true');
  });

  // After auto-reconnect we consider the user to have opted-in (they did, last
  // session), so isRemembered mirrors the persisted truth.
  it('surfaces isRemembered=true after auto-reconnect', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500);
    await act(async () => { vi.advanceTimersByTime(10); });

    expect(screen.getByTestId('is-remembered').textContent).toBe('true');
  });
});

describe('WalletContext — opt-in connect', () => {
  it('defaults to NOT remembering when options.remember is omitted', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider();
    await act(async () => {
      screen.getByTestId('connect-btn').click();
    });

    await flushPromises();
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(walletUtils.setWalletRemembered).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('is-remembered').textContent).toBe('false');
    expect(walletUtils.recordRecentWallet).toHaveBeenCalledWith('freighter');
  });

  it('passes remember=true through to setWalletRemembered', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider();
    await act(async () => {
      screen.getByTestId('connect-remember-btn').click();
    });

    await flushPromises();
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(walletUtils.setWalletRemembered).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('is-remembered').textContent).toBe('true');
    expect(walletUtils.recordRecentWallet).toHaveBeenCalledWith('freighter');
  });

  it('treats remember=false explicitly as opting out', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue({
      ...STORED_WALLET,
      type: 'albedo',
      publicKey: 'GDEF',
    });

    renderProvider();
    await act(async () => {
      screen.getByTestId('connect-bool-btn').click();
    });

    await flushPromises();
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(walletUtils.setWalletRemembered).toHaveBeenCalledWith(false);
    expect(walletUtils.recordRecentWallet).toHaveBeenCalledWith('albedo');
  });

  it('does not write persisted remember state on connection failure', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue({
      type: 'connection_failed',
      message: 'fail',
    });

    renderProvider();
    await act(async () => {
      screen.getByTestId('connect-remember-btn').click();
    });

    await flushPromises();
    expect(screen.getByTestId('status').textContent).toBe('error');
    // setWalletRemembered must never be called on a failed connect
    expect(walletUtils.setWalletRemembered).not.toHaveBeenCalled();
  });
});

describe('WalletContext — forgetRememberedChoice', () => {
  it('clears the remember flag without changing connection status', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500);
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(screen.getByTestId('status').textContent).toBe('connected');

    await act(async () => {
      screen.getByTestId('forget-btn').click();
    });

    // Status stays connected (we do NOT disconnect).
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(walletUtils.setWalletRemembered).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('is-remembered').textContent).toBe('false');
  });

  it('forgetRememberedChoice on a fresh provider is safe (no stored wallet)', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    renderProvider();
    await act(async () => { vi.runAllTimers(); });

    await act(async () => {
      screen.getByTestId('forget-btn').click();
    });

    expect(walletUtils.setWalletRemembered).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });
});

describe('WalletContext — disconnect clears remember state', () => {
  it('clears the remember flag via disconnect', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500);
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(screen.getByTestId('is-remembered').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('disconnect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('is-remembered').textContent).toBe('false');
    expect(walletUtils.disconnectWallet).toHaveBeenCalled();
  });
});

describe('WalletContext — auto-reconnect', () => {
  // 1
  it('stays disconnected when no wallet is stored', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    renderProvider();
    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(walletUtils.connectWallet).not.toHaveBeenCalled();
  });

  // 2
  it('transitions to "reconnecting" immediately when a stored wallet is found', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    // connectWallet never resolves in this test (pending promise)
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderProvider();
    // After the initial render (before any timers), status should be reconnecting
    await act(async () => {});
    expect(screen.getByTestId('status').textContent).toBe('reconnecting');
  });

  // 3
  it('transitions to "connected" when reconnect succeeds within the timeout', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500); // 500 ms timeout
    await act(async () => {
      vi.advanceTimersByTime(10); // resolve immediately, well within timeout
    });

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
    expect(screen.getByTestId('wallet').textContent).toBe(STORED_WALLET.publicKey);
  });

  // 4
  it('sets reconnectTimedOut=true when timeout fires before reconnect resolves', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    // Keep the connect pending
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderProvider(300); // 300 ms timeout
    await act(async () => {
      vi.advanceTimersByTime(301); // fire the timeout
    });

    expect(screen.getByTestId('status').textContent).toBe('reconnecting');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('true');
  });

  // 5
  it('resets reconnectTimedOut to false when reconnect eventually succeeds', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);

    let resolveConnect!: (v: typeof STORED_WALLET) => void;
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(
      new Promise((res) => { resolveConnect = res; }),
    );

    renderProvider(200);

    // Fire the timeout
    await act(async () => { vi.advanceTimersByTime(201); });
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('true');

    // Now let the connect finish
    await act(async () => { resolveConnect(STORED_WALLET); });

    await flushPromises();
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
  });

  // 6
  it('transitions to "error" and resets reconnectTimedOut when reconnect fails', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue({
      type: 'connection_failed',
      message: 'Extension unavailable',
    });

    renderProvider(500);
    await act(async () => { vi.runAllTimers(); });

    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('error').textContent).toBe('connection_failed');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
  });

  // 7
  it('dismissReconnectBanner clears reconnectTimedOut without changing status', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderProvider(200);
    await act(async () => { vi.advanceTimersByTime(201); });
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('dismiss-btn').click();
    });

    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
    // Status unchanged — reconnect still in flight
    expect(screen.getByTestId('status').textContent).toBe('reconnecting');
  });

  // 8
  it('retryReconnect re-runs reconnect with a fresh timeout window', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);

    let callCount = 0;
    vi.spyOn(walletUtils, 'connectWallet').mockImplementation(
      () => new Promise((_, reject) => {
        callCount++;
        // First call → reject immediately; second call → stay pending
        if (callCount === 1) reject({ type: 'connection_failed', message: 'fail' });
      }),
    );

    renderProvider(200);

    // Wait for first reconnect to fail
    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('status').textContent).toBe('error');

    // Now let the second call stay pending
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    await act(async () => {
      screen.getByTestId('retry-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('reconnecting');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
  });

  // 9
  it('retryReconnect is a no-op when no stored wallet exists', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);

    renderProvider();
    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('status').textContent).toBe('disconnected');

    await act(async () => {
      screen.getByTestId('retry-btn').click();
    });

    expect(walletUtils.connectWallet).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });

  // 10
  it('disconnect clears wallet, resets status and reconnectTimedOut', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderProvider(200);
    await act(async () => { vi.advanceTimersByTime(201); });
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('disconnect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('wallet').textContent).toBe('null');
    expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
    expect(walletUtils.disconnectWallet).toHaveBeenCalled();
  });

  // 11
  it('user-initiated connect() uses "connecting" state, not "reconnecting"', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderProvider(200);
    await act(async () => {
      screen.getByTestId('connect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('connecting');
  });

  // 12
  it('cleans up timeout timer on unmount (no setState-on-unmounted warning)', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    const consoleSpy = vi.spyOn(console, 'error');

    const { unmount } = renderProvider(200);
    await act(async () => {
      // Unmount before the timeout fires
      unmount();
      vi.advanceTimersByTime(500); // fire timers post-unmount
    });

    // React's "Can't perform a React state update on an unmounted component"
    // warning (pre-18 wording) must not appear.
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unmounted'),
    );
  });
});

// ─── #961 — cache invalidation after account or network switching ───────────

describe('WalletContext — cache invalidation on account/network switch (#961)', () => {
  const ACCOUNT_A = { type: 'freighter' as const, publicKey: 'GAAA111', network: 'PUBLIC' };
  const ACCOUNT_B = { type: 'freighter' as const, publicKey: 'GBBB222', network: 'PUBLIC' };

  function mockBalancesFetch(asset: string, balance: string) {
    return vi.fn().mockResolvedValue({
      json: async () => ({
        balances: [{ asset_type: asset === 'XLM' ? 'native' : 'credit_alphanum4', asset_code: asset, balance }],
      }),
    });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears balances when connecting a different account than the one previously connected', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_A);
    (global.fetch as any) = mockBalancesFetch('XLM', '100');

    renderProvider();
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_A.publicKey);

    // Populate the cache the way the dropdown normally would.
    await act(async () => { screen.getByTestId('refresh-balance-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('balances').textContent).toBe('XLM:100');
    expect(screen.getByTestId('last-updated').textContent).toBe('set');

    // Disconnect, then connect a *different* account.
    await act(async () => { screen.getByTestId('disconnect-btn').click(); });
    expect(screen.getByTestId('balances').textContent).toBe('null');
    expect(screen.getByTestId('last-updated').textContent).toBe('null');

    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_B);
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();

    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_B.publicKey);
    // Account A's balances must never be visible under Account B's identity.
    expect(screen.getByTestId('balances').textContent).toBe('null');
    expect(screen.getByTestId('last-updated').textContent).toBe('null');
  });

  it('does not clear balances when the same identity is reconfirmed (stayConnected-style refresh)', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(ACCOUNT_A);
    (global.fetch as any) = mockBalancesFetch('XLM', '100');

    renderProvider();
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();
    await act(async () => { screen.getByTestId('refresh-balance-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('balances').textContent).toBe('XLM:100');

    // Re-derive the identity via refreshWalletIdentity — connectWallet
    // resolves with the *same* account, so this must be a no-op for the
    // balance cache (a naive "always clear on any wallet update" approach
    // would wrongly wipe it here).
    await act(async () => { screen.getByTestId('refresh-identity-btn').click(); });
    await flushPromises();

    expect(screen.getByTestId('balances').textContent).toBe('XLM:100');
  });

  it('refreshWalletIdentity picks up an out-of-band network switch and clears stale balances', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_A);
    (global.fetch as any) = mockBalancesFetch('XLM', '100');

    renderProvider();
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();
    await act(async () => { screen.getByTestId('refresh-balance-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('wallet-network').textContent).toBe('PUBLIC');
    expect(screen.getByTestId('balances').textContent).toBe('XLM:100');

    // Simulate switchNetwork() having changed the extension's active
    // network out from under the app — the next connectWallet() call
    // (as refreshWalletIdentity performs) now reports TESTNET.
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce({
      ...ACCOUNT_A,
      network: 'TESTNET',
    });

    await act(async () => { screen.getByTestId('refresh-identity-btn').click(); });
    await flushPromises();

    expect(screen.getByTestId('wallet-network').textContent).toBe('TESTNET');
    // The PUBLIC-network balance must not survive under the TESTNET identity.
    expect(screen.getByTestId('balances').textContent).toBe('null');
    expect(screen.getByTestId('last-updated').textContent).toBe('null');
  });

  it('refreshWalletIdentity leaves wallet state untouched when the identity check itself fails', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_A);
    renderProvider();
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();

    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValueOnce({
      type: 'connection_failed',
      message: 'Extension unavailable',
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => { screen.getByTestId('refresh-identity-btn').click(); });
    await flushPromises();

    // A failed background identity check must not disconnect an otherwise
    // healthy session, and must not flip status to 'error'.
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_A.publicKey);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('discards a balance response that resolves after the wallet has already switched accounts', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_A);

    let resolveFetch!: (v: any) => void;
    const pendingFetch = new Promise((res) => { resolveFetch = res; });
    (global.fetch as any) = vi.fn().mockReturnValueOnce(pendingFetch);

    renderProvider();
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();

    // Kick off a balance fetch for Account A, but do not let it resolve yet.
    act(() => { screen.getByTestId('refresh-balance-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('balances').textContent).toBe('null'); // still in flight

    // Switch to Account B *before* Account A's fetch resolves.
    await act(async () => { screen.getByTestId('disconnect-btn').click(); });
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(ACCOUNT_B);
    await act(async () => { screen.getByTestId('connect-btn').click(); });
    await flushPromises();
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_B.publicKey);

    // Now let Account A's stale fetch resolve.
    await act(async () => {
      resolveFetch({ json: async () => ({ balances: [{ asset_type: 'native', asset_code: 'XLM', balance: '100' }] }) });
    });
    await flushPromises();

    // Account A's late-arriving balance must never appear under Account B.
    expect(screen.getByTestId('wallet').textContent).toBe(ACCOUNT_B.publicKey);
    expect(screen.getByTestId('balances').textContent).toBe('null');
  });
});
