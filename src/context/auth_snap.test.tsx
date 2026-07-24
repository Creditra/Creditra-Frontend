/**
 * auth_snap.test.tsx
 *
 * Snapshot tests for the wallet-auth surface of WalletContext.
 *
 * ## What these snapshots verify
 *
 * Every snapshot encodes the **complete auth state shape** — status,
 * wallet identity, error discriminator, and opt-in flags — after a specific
 * lifecycle transition.  If any field changes unexpectedly (e.g. an error
 * discriminator is renamed, a field is silently dropped) CI will catch it
 * immediately without requiring a human to review the diff manually.
 *
 * ## require_auth semantics
 *
 * Matching the Soroban `require_auth` pattern, every state-changing
 * entrypoint is tested to confirm it gates on valid wallet identity:
 *
 *   - `connect(type)`               — initiates auth; no state mutation on failure
 *   - `connect(type, {remember})`   — opt-in remember flag is only persisted
 *                                      on success, never on failure
 *   - `disconnect()`                — full auth reset; clears wallet + flags
 *   - `forgetRememberedChoice()`    — partial reset; wallet stays connected
 *   - `retryReconnect()`            — requires stored preference; no-op otherwise
 *   - `dismissReconnectBanner()`    — UI-only; does not change auth status
 *   - `stayConnected()`             — re-validates liveness; transitions to error
 *                                      on failure rather than silently degrading
 *
 * ## Overflow / edge-case safety
 *
 * All snapshots use deterministic wallet fixtures. No live network calls are
 * made; every wallet utility is fully mocked.
 *
 * @see docs/AUTH_SNAP.md for the full rationale and update instructions.
 */

import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletProvider, useWallet } from './WalletContext';
import type { WalletInfo } from '../types/wallet';
import * as walletUtils from '../utils/wallet';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A fully-resolved, connected wallet — used as the happy-path return value. */
const WALLET_FREIGHTER: WalletInfo = {
  type: 'freighter',
  publicKey: 'GAUTHSNAP000FREIGHTER0000000000000000000000000000000001',
  network: 'PUBLIC',
};

const WALLET_ALBEDO: WalletInfo = {
  type: 'albedo',
  publicKey: 'GAUTHSNAP000ALBEDO00000000000000000000000000000000000002',
  network: 'PUBLIC',
};

/** Discriminated error shapes — one per WalletError.type variant. */
const ERR_NOT_FOUND = { type: 'not_found' as const, message: 'Freighter not installed.' };
const ERR_CONNECTION_FAILED = { type: 'connection_failed' as const, message: 'Extension refused.' };
const ERR_WRONG_NETWORK = { type: 'wrong_network' as const, message: 'Switch to Stellar mainnet.' };
const ERR_USER_REJECTED = { type: 'user_rejected' as const, message: 'User cancelled.' };

// ─── Test consumer ────────────────────────────────────────────────────────────

/**
 * Minimal React component that exposes the entire auth state as a plain JS
 * object so `toMatchSnapshot()` can serialize it deterministically.
 *
 * We capture state via a ref rather than DOM text so the snapshot contains
 * the typed shape, not HTML.
 */
interface AuthStateCapture {
  status: string;
  wallet: WalletInfo | null;
  error: { type: string; message: string } | null;
  reconnectTimedOut: boolean;
  isRemembered: boolean;
}

let capturedState: AuthStateCapture | null = null;

function AuthStateCaptor() {
  const { status, wallet, error, reconnectTimedOut, isRemembered } = useWallet();
  capturedState = { status, wallet, error, reconnectTimedOut, isRemembered };
  return null;
}

/** Render the provider with an optional timeout override and collect initial state. */
function renderAuth(timeoutMs = 200, sessionTimeoutMs = 60_000) {
  return render(
    <WalletProvider timeoutMs={timeoutMs} sessionTimeoutMs={sessionTimeoutMs}>
      <AuthStateCaptor />
    </WalletProvider>,
  );
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  capturedState = null;
  window.localStorage.clear();

  // Default: no stored wallet, no remembered flag, connect succeeds.
  vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
  vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(false);
  vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
  vi.spyOn(walletUtils, 'disconnectWallet').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'saveWalletPreference').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'recordRecentWallet').mockImplementation(() => {});
  vi.spyOn(walletUtils, 'setWalletRemembered').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Helper: imperatively invoke context actions ──────────────────────────────

/**
 * Wrap the provider in a ref-based harness so tests can call context
 * functions directly without needing a button tree.
 */
type WalletAPI = ReturnType<typeof useWallet>;
let walletAPI: WalletAPI | null = null;

function AuthAPICaptor() {
  walletAPI = useWallet();
  const { status, wallet, error, reconnectTimedOut, isRemembered } = walletAPI;
  capturedState = { status, wallet, error, reconnectTimedOut, isRemembered };
  return null;
}

function renderWithAPI(timeoutMs = 200, sessionTimeoutMs = 60_000) {
  walletAPI = null;
  return render(
    <WalletProvider timeoutMs={timeoutMs} sessionTimeoutMs={sessionTimeoutMs}>
      <AuthAPICaptor />
    </WalletProvider>,
  );
}

// ─── 1. Initial state ─────────────────────────────────────────────────────────

describe('auth snapshot — initial state', () => {
  it('disconnected state with no stored wallet matches snapshot', async () => {
    renderAuth();
    await act(async () => { vi.runAllTimers(); });
    expect(capturedState).toMatchSnapshot();
  });

  it('initial state with stored wallet but no remember flag matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(false);
    renderAuth();
    await act(async () => { vi.runAllTimers(); });
    // Should stay disconnected — require_auth: no remembered opt-in.
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 2. Auto-reconnect (require_auth: stored + remembered) ───────────────────

describe('auth snapshot — auto-reconnect lifecycle', () => {
  it('reconnecting state matches snapshot (pending connect)', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderAuth();
    await act(async () => {}); // flush microtasks only; do NOT advance timers
    expect(capturedState).toMatchSnapshot();
  });

  it('connected state after successful auto-reconnect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);

    renderAuth(500);
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(capturedState).toMatchSnapshot();
  });

  it('reconnectTimedOut=true state matches snapshot (timeout fires before connect resolves)', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderAuth(300);
    await act(async () => { vi.advanceTimersByTime(301); });
    expect(capturedState).toMatchSnapshot();
  });

  it('error state after failed auto-reconnect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_CONNECTION_FAILED);

    renderAuth(500);
    await act(async () => { vi.runAllTimers(); });
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 3. User-initiated connect (require_auth per wallet type) ─────────────────

describe('auth snapshot — user-initiated connect', () => {
  it('connecting state (in-flight) matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));
    renderWithAPI();
    await act(async () => { walletAPI!.connect('freighter'); });
    expect(capturedState).toMatchSnapshot();
  });

  it('connected state after freighter connect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState).toMatchSnapshot();
  });

  it('connected state after albedo connect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_ALBEDO);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('albedo'); });
    expect(capturedState).toMatchSnapshot();
  });

  it('connected+remembered state after connect({remember:true}) matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter', { remember: true }); });
    expect(capturedState).toMatchSnapshot();
  });

  it('connected+not-remembered state after connect({remember:false}) matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter', { remember: false }); });
    expect(capturedState).toMatchSnapshot();
  });

  it('connected+not-remembered state when remember option is omitted matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 4. Connect error variants (require_auth: each error type is distinct) ────

describe('auth snapshot — connect error variants', () => {
  it('error state for not_found matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_NOT_FOUND);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState?.status).toBe('error');
    expect(capturedState).toMatchSnapshot();
  });

  it('error state for connection_failed matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_CONNECTION_FAILED);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState?.status).toBe('error');
    expect(capturedState).toMatchSnapshot();
  });

  it('error state for wrong_network matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_WRONG_NETWORK);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState?.status).toBe('error');
    expect(capturedState).toMatchSnapshot();
  });

  it('error state for user_rejected matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_USER_REJECTED);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    expect(capturedState?.status).toBe('error');
    expect(capturedState).toMatchSnapshot();
  });

  it('require_auth: remember flag is NOT persisted on connect failure', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockRejectedValue(ERR_CONNECTION_FAILED);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter', { remember: true }); });
    expect(capturedState?.status).toBe('error');
    // setWalletRemembered must NEVER be called on failure — this is the
    // require_auth analog: no side-effects without a successful auth.
    expect(walletUtils.setWalletRemembered).not.toHaveBeenCalled();
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 5. Disconnect (require_auth: full state reset) ───────────────────────────

describe('auth snapshot — disconnect', () => {
  it('disconnected state after explicit disconnect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter', { remember: true }); });
    await act(async () => { walletAPI!.disconnect(); });
    expect(capturedState).toMatchSnapshot();
  });

  it('disconnectWallet() is called exactly once on disconnect', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    await act(async () => { walletAPI!.disconnect(); });
    expect(walletUtils.disconnectWallet).toHaveBeenCalledTimes(1);
  });
});

// ─── 6. forgetRememberedChoice (partial auth reset) ───────────────────────────

describe('auth snapshot — forgetRememberedChoice', () => {
  it('state after forgetRememberedChoice on a connected wallet matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter', { remember: true }); });
    await act(async () => { walletAPI!.forgetRememberedChoice(); });
    // Wallet stays connected; only isRemembered flips.
    expect(capturedState).toMatchSnapshot();
  });

  it('forgetRememberedChoice on a fresh (disconnected) provider matches snapshot', async () => {
    renderWithAPI();
    await act(async () => { vi.runAllTimers(); });
    await act(async () => { walletAPI!.forgetRememberedChoice(); });
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 7. Banner controls (UI-only, no auth state change) ───────────────────────

describe('auth snapshot — dismissReconnectBanner', () => {
  it('state after dismissing the timeout banner matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet').mockReturnValue(new Promise(() => {}));

    renderWithAPI(200);
    await act(async () => { vi.advanceTimersByTime(201); }); // trigger timeout flag
    expect(capturedState?.reconnectTimedOut).toBe(true);

    await act(async () => { walletAPI!.dismissReconnectBanner(); });
    // Status stays 'reconnecting'; only the banner flag clears.
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 8. retryReconnect ────────────────────────────────────────────────────────

describe('auth snapshot — retryReconnect', () => {
  it('reconnecting state immediately after retryReconnect matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'isWalletRemembered').mockReturnValue(true);
    vi.spyOn(walletUtils, 'connectWallet')
      .mockRejectedValueOnce(ERR_CONNECTION_FAILED)
      .mockReturnValue(new Promise(() => {}));

    renderWithAPI(200);
    await act(async () => { vi.runAllTimers(); }); // first attempt fails
    expect(capturedState?.status).toBe('error');

    await act(async () => { walletAPI!.retryReconnect(); });
    expect(capturedState).toMatchSnapshot();
  });

  it('no-op state when retryReconnect is called with no stored wallet matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(null);
    renderWithAPI();
    await act(async () => { vi.runAllTimers(); });
    await act(async () => { walletAPI!.retryReconnect(); });
    expect(walletUtils.connectWallet).not.toHaveBeenCalled();
    expect(capturedState).toMatchSnapshot();
  });
});

// ─── 9. stayConnected (re-auth liveness check) ────────────────────────────────

describe('auth snapshot — stayConnected', () => {
  it('connected state is preserved after successful stayConnected matches snapshot', async () => {
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    vi.spyOn(walletUtils, 'connectWallet').mockResolvedValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    await act(async () => { await walletAPI!.stayConnected(); });
    expect(capturedState).toMatchSnapshot();
  });

  it('error state after failed stayConnected matches snapshot', async () => {
    vi.spyOn(walletUtils, 'connectWallet')
      .mockResolvedValueOnce(WALLET_FREIGHTER)
      .mockRejectedValueOnce(ERR_CONNECTION_FAILED);
    vi.spyOn(walletUtils, 'getStoredWallet').mockReturnValue(WALLET_FREIGHTER);
    renderWithAPI();
    await act(async () => { await walletAPI!.connect('freighter'); });
    await act(async () => { await walletAPI!.stayConnected(); });
    expect(capturedState?.status).toBe('error');
    expect(capturedState).toMatchSnapshot();
  });

  it('stayConnected is no-op when no wallet is connected matches snapshot', async () => {
    renderWithAPI();
    await act(async () => { vi.runAllTimers(); });
    await act(async () => { await walletAPI!.stayConnected(); });
    expect(walletUtils.connectWallet).not.toHaveBeenCalled();
    expect(capturedState).toMatchSnapshot();
  });
});
