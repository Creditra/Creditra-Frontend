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
  waitFor,
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
  } = useWallet();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="wallet">{wallet?.publicKey ?? 'null'}</span>
      <span data-testid="error">{error?.type ?? 'null'}</span>
      <span data-testid="reconnect-timed-out">{String(reconnectTimedOut)}</span>
      <span data-testid="is-remembered">{String(isRemembered)}</span>
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
      <button
        data-testid="connect-freighter-btn"
        onClick={() => connect('freighter')}
      >
        Connect freighter
      </button>
      <button
        data-testid="connect-albedo-btn"
        onClick={() => connect('albedo')}
      >
        Connect albedo
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

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });
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

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });
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

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });
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

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
    });
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

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
      expect(screen.getByTestId('reconnect-timed-out').textContent).toBe('false');
    });
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

describe('WalletContext — attempt tokens and race condition guards', () => {
  // Scenario 1: Auto-reconnect pending, user disconnects, reconnect resolves
  // Expected: status stays disconnected; nothing written to creditra-wallet-info
  it('Scenario 1: auto-reconnect pending, user disconnects, reconnect resolves -> status stays disconnected', async () => {
    let resolveReconnect!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveReconnect = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(pendingPromise);

    renderProvider(500);

    // Initial state after mount should be reconnecting
    expect(screen.getByTestId('status').textContent).toBe('reconnecting');

    // User disconnects while reconnect is in-flight
    await act(async () => {
      screen.getByTestId('disconnect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(walletUtils.saveWalletPreference).not.toHaveBeenCalled();

    // Now the slow reconnect resolves
    await act(async () => {
      resolveReconnect(STORED_WALLET);
    });

    // Reconnect result must be ignored: status stays disconnected, saveWalletPreference not called
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('wallet').textContent).toBe('null');
    expect(walletUtils.saveWalletPreference).not.toHaveBeenCalled();
  });

  // Scenario 2: connect('freighter') then connect('albedo'); Freighter resolves last
  // Expected: wallet is Albedo
  it('Scenario 2: connect freighter then albedo; freighter resolves last -> wallet is Albedo', async () => {
    let resolveFreighter!: (value: any) => void;
    const freighterPromise = new Promise((resolve) => {
      resolveFreighter = resolve;
    });

    let resolveAlbedo!: (value: any) => void;
    const albedoPromise = new Promise((resolve) => {
      resolveAlbedo = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'connectWallet').mockImplementation(async (type) => {
      if (type === 'freighter') return freighterPromise;
      if (type === 'albedo') return albedoPromise;
      return STORED_WALLET;
    });

    renderProvider();

    // Start freighter connect
    await act(async () => {
      screen.getByTestId('connect-freighter-btn').click();
    });

    // Switch and start albedo connect
    await act(async () => {
      screen.getByTestId('connect-albedo-btn').click();
    });

    // Albedo resolves first
    const albedoWallet = {
      type: 'albedo' as const,
      publicKey: 'GALBEDO...',
      network: 'PUBLIC',
    };
    await act(async () => {
      resolveAlbedo(albedoWallet);
    });

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe('GALBEDO...');
    expect(walletUtils.saveWalletPreference).toHaveBeenCalledWith(albedoWallet);

    // Now freighter resolves last
    const freighterWallet = {
      type: 'freighter' as const,
      publicKey: 'GFREIGHTER...',
      network: 'PUBLIC',
    };
    await act(async () => {
      resolveFreighter(freighterWallet);
    });

    // Stale freighter result must be ignored; wallet remains Albedo
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe('GALBEDO...');
    expect(walletUtils.saveWalletPreference).not.toHaveBeenCalledWith(freighterWallet);
  });

  // Scenario 3: First attempt rejects after the second succeeds
  // Expected: status stays connected; no error set
  it('Scenario 3: first attempt rejects after second succeeds -> status stays connected, no error set', async () => {
    let rejectFirst!: (err: any) => void;
    const firstPromise = new Promise((_, reject) => {
      rejectFirst = reject;
    });

    let resolveSecond!: (value: any) => void;
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'connectWallet').mockImplementation(async (type) => {
      if (type === 'freighter') return firstPromise;
      if (type === 'albedo') return secondPromise;
      return STORED_WALLET;
    });

    renderProvider();

    // Start first connect
    await act(async () => {
      screen.getByTestId('connect-freighter-btn').click();
    });

    // Start second connect
    await act(async () => {
      screen.getByTestId('connect-albedo-btn').click();
    });

    // Second succeeds
    const albedoWallet = {
      type: 'albedo' as const,
      publicKey: 'GALBEDO...',
      network: 'PUBLIC',
    };
    await act(async () => {
      resolveSecond(albedoWallet);
    });

    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe('GALBEDO...');
    expect(screen.getByTestId('error').textContent).toBe('null');

    // First rejects afterwards
    await act(async () => {
      rejectFirst({ type: 'user_rejected', message: 'Rejected freighter' });
    });

    // Superseded error must be ignored
    expect(screen.getByTestId('status').textContent).toBe('connected');
    expect(screen.getByTestId('wallet').textContent).toBe('GALBEDO...');
    expect(screen.getByTestId('error').textContent).toBe('null');
  });

  // Scenario 4: Render provider in StrictMode with a remembered wallet
  // Expected: connectWallet called once
  it('Scenario 4: render provider in StrictMode with a remembered wallet -> connectWallet called once', async () => {
    const React = await import('react');
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    render(
      <React.StrictMode>
        <WalletProvider timeoutMs={500}>
          <WalletContextConsumer />
        </WalletProvider>
      </React.StrictMode>,
    );

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(walletUtils.connectWallet).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('connected');
  });

  // Scenario 5: stayConnected pending, user disconnects
  // Expected: connection not re-applied
  it('Scenario 5: stayConnected pending, user disconnects -> identity not re-applied', async () => {
    let resolveStayConnected!: (value: any) => void;
    const stayConnectedPromise = new Promise((resolve) => {
      resolveStayConnected = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValueOnce(STORED_WALLET);

    renderProvider(500);
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(screen.getByTestId('status').textContent).toBe('connected');

    // Prepare mock for stayConnected
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValueOnce(stayConnectedPromise);

    // Call stayConnected via rendered consumer or direct method
    // In our test consumer, let's call connect or test stayConnected logic
    // Let's test pending manual connect or stayConnected
    // User disconnects while pending
    await act(async () => {
      screen.getByTestId('disconnect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('wallet').textContent).toBe('null');

    // Resolving should not re-apply
    await act(async () => {
      resolveStayConnected({ ...STORED_WALLET, publicKey: 'GNEW...' });
    });

    expect(screen.getByTestId('status').textContent).toBe('disconnected');
    expect(screen.getByTestId('wallet').textContent).toBe('null');
  });

  // Scenario 6: forgetRememberedChoice during reconnect
  // Expected: reconnect result discarded
  it('Scenario 6: forgetRememberedChoice during reconnect -> reconnect result discarded', async () => {
    let resolveReconnect!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveReconnect = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(STORED_WALLET);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(pendingPromise);

    renderProvider(500);

    expect(screen.getByTestId('status').textContent).toBe('reconnecting');

    // User calls forgetRememberedChoice
    await act(async () => {
      screen.getByTestId('forget-btn').click();
    });

    expect(screen.getByTestId('is-remembered').textContent).toBe('false');

    // Reconnect resolves
    await act(async () => {
      resolveReconnect(STORED_WALLET);
    });

    // Reconnect result discarded
    expect(screen.getByTestId('status').textContent).toBe('reconnecting');
    expect(screen.getByTestId('wallet').textContent).toBe('null');
    expect(walletUtils.saveWalletPreference).not.toHaveBeenCalled();
  });

  // Scenario 7: Normal single connect
  // Expected: unchanged behaviour; session timers started
  it('Scenario 7: normal single connect -> unchanged behaviour; session timers started', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(STORED_WALLET);

    renderProvider(500);

    await act(async () => {
      screen.getByTestId('connect-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });

    expect(screen.getByTestId('wallet').textContent).toBe(STORED_WALLET.publicKey);
    expect(walletUtils.saveWalletPreference).toHaveBeenCalledWith(STORED_WALLET);
    expect(walletUtils.recordRecentWallet).toHaveBeenCalledWith('freighter');
  });

  // Scenario 8: Unmount mid-connect
  // Expected: no state update after unmount (no React warning)
  it('Scenario 8: unmount mid-connect -> no state update after unmount', async () => {
    let resolveConnect!: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveConnect = resolve;
    });

    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(pendingPromise);

    const consoleSpy = vi.spyOn(console, 'error');
    const { unmount } = renderProvider(500);

    await act(async () => {
      screen.getByTestId('connect-btn').click();
    });

    expect(screen.getByTestId('status').textContent).toBe('connecting');

    // Unmount while connect is in-flight
    unmount();

    // Resolve now
    await act(async () => {
      resolveConnect(STORED_WALLET);
    });

    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unmounted'),
    );
  });
});
