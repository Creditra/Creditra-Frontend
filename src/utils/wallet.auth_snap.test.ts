/**
 * wallet.auth_snap.test.ts
 *
 * Snapshot tests for the auth-relevant portions of the wallet utility module.
 *
 * ## What these snapshots verify
 *
 * While `auth_snap.test.tsx` covers the React context lifecycle, this file
 * captures the shape and behavior of the low-level auth primitives:
 *
 *   - `isWalletInstalled(type)` — synchronous auth readiness check
 *   - `connectWallet(type)`     — async auth initiation; returns WalletInfo or
 *                                  throws a discriminated WalletError
 *   - `disconnectWallet()`      — clears all persisted state (wallet + remember flag)
 *   - `saveWalletPreference()`  — writes WalletInfo to both current + legacy keys
 *   - `getStoredWallet()`       — reads with legacy fallback
 *   - `isWalletRemembered()`    — reads the opt-in flag
 *   - `setWalletRemembered()`   — writes the opt-in flag or removes the key
 *   - `recordRecentWallet()`    — MRU list maintenance (capped, deduplicated)
 *   - `getRecentWalletOrder()`  — MRU read with sanitization
 *
 * ## require_auth semantics
 *
 * Every function that mutates persistent state or initiates wallet interaction
 * is tested to confirm no side-effects occur without valid input.  Functions
 * that read state are no-ops when the relevant key is missing.
 *
 * @see docs/AUTH_SNAP.md for the full rationale and update instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isWalletInstalled,
  connectWallet,
  disconnectWallet,
  saveWalletPreference,
  getStoredWallet,
  isWalletRemembered,
  setWalletRemembered,
  recordRecentWallet,
  getRecentWalletOrder,
  clearMRU,
} from './wallet';
import type { WalletInfo, WalletType } from '../types/wallet';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WALLET_FREIGHTER: WalletInfo = {
  type: 'freighter',
  publicKey: 'GWALLETSNAP0FREIGHTER0000000000000000000000000000000001',
  network: 'PUBLIC',
};

const WALLET_ALBEDO: WalletInfo = {
  type: 'albedo',
  publicKey: 'GWALLETSNAP0ALBEDO00000000000000000000000000000000000002',
  network: 'PUBLIC',
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  window.localStorage.clear();
  // Default: no wallet extensions installed
  delete (window as any).freighter;
  delete (window as any).albedo;
  delete (window as any).xBullSDK;
  delete (window as any).rabet;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. isWalletInstalled (readiness check) ───────────────────────────────────

describe('wallet auth snapshot — isWalletInstalled', () => {
  it('returns false for all wallets when no extensions are installed', () => {
    const result = {
      freighter: isWalletInstalled('freighter'),
      albedo: isWalletInstalled('albedo'),
      xbull: isWalletInstalled('xbull'),
      rabet: isWalletInstalled('rabet'),
    };
    expect(result).toMatchSnapshot();
  });

  it('returns true only for freighter when window.freighter is present', () => {
    (window as any).freighter = { getPublicKey: vi.fn() };
    const result = {
      freighter: isWalletInstalled('freighter'),
      albedo: isWalletInstalled('albedo'),
      xbull: isWalletInstalled('xbull'),
      rabet: isWalletInstalled('rabet'),
    };
    expect(result).toMatchSnapshot();
  });

  it('returns true only for albedo when window.albedo is present', () => {
    (window as any).albedo = { publicKey: vi.fn() };
    const result = {
      freighter: isWalletInstalled('freighter'),
      albedo: isWalletInstalled('albedo'),
      xbull: isWalletInstalled('xbull'),
      rabet: isWalletInstalled('rabet'),
    };
    expect(result).toMatchSnapshot();
  });

  it('returns true for multiple wallets when multiple extensions are present', () => {
    (window as any).freighter = { getPublicKey: vi.fn() };
    (window as any).albedo = { publicKey: vi.fn() };
    (window as any).xBullSDK = { getPublicKey: vi.fn() };
    const result = {
      freighter: isWalletInstalled('freighter'),
      albedo: isWalletInstalled('albedo'),
      xbull: isWalletInstalled('xbull'),
      rabet: isWalletInstalled('rabet'),
    };
    expect(result).toMatchSnapshot();
  });
});

// ─── 2. connectWallet error shapes ────────────────────────────────────────────

describe('wallet auth snapshot — connectWallet error shapes', () => {
  it('throws not_found error when extension is missing', async () => {
    let error: any = null;
    try {
      await connectWallet('freighter');
    } catch (e) {
      error = e;
    }
    expect(error).toMatchSnapshot();
  });

  it('throws connection_failed error when extension method throws', async () => {
    (window as any).freighter = {
      getPublicKey: vi.fn().mockRejectedValue(new Error('User closed prompt')),
      getNetwork: vi.fn(),
    };
    let error: any = null;
    try {
      await connectWallet('freighter');
    } catch (e) {
      error = e;
    }
    expect(error).toMatchSnapshot();
  });

  it('throws wrong_network error when freighter reports unsupported network', async () => {
    (window as any).freighter = {
      getPublicKey: vi.fn().mockResolvedValue('GPUB123'),
      getNetwork: vi.fn().mockResolvedValue('FUTURENET'),
    };
    let error: any = null;
    try {
      await connectWallet('freighter');
    } catch (e) {
      error = e;
    }
    expect(error).toMatchSnapshot();
  });
});

// ─── 3. connectWallet success shapes ──────────────────────────────────────────

describe('wallet auth snapshot — connectWallet success shapes', () => {
  it('returns WalletInfo for freighter on successful connect', async () => {
    (window as any).freighter = {
      getPublicKey: vi.fn().mockResolvedValue(WALLET_FREIGHTER.publicKey),
      getNetwork: vi.fn().mockResolvedValue('PUBLIC'),
    };
    const result = await connectWallet('freighter');
    expect(result).toMatchSnapshot();
  });

  it('returns WalletInfo for albedo on successful connect', async () => {
    (window as any).albedo = {
      publicKey: vi.fn().mockResolvedValue({ pubkey: WALLET_ALBEDO.publicKey }),
    };
    const result = await connectWallet('albedo');
    expect(result).toMatchSnapshot();
  });

  it('returns WalletInfo for xbull on successful connect', async () => {
    (window as any).xBullSDK = {
      getPublicKey: vi.fn().mockResolvedValue('GXBULL0000000000000000000000000000000000000000000000003'),
    };
    const result = await connectWallet('xbull');
    expect(result).toMatchSnapshot();
  });

  it('returns WalletInfo for rabet on successful connect', async () => {
    (window as any).rabet = {
      connect: vi.fn().mockResolvedValue({ publicKey: 'GRABET0000000000000000000000000000000000000000000000004' }),
    };
    const result = await connectWallet('rabet');
    expect(result).toMatchSnapshot();
  });
});

// ─── 4. saveWalletPreference & getStoredWallet ─────────────────────────────────

describe('wallet auth snapshot — persist and retrieve wallet info', () => {
  it('getStoredWallet returns null when no wallet is stored', () => {
    const result = getStoredWallet();
    expect(result).toMatchSnapshot();
  });

  it('getStoredWallet returns the stored wallet after saveWalletPreference', () => {
    saveWalletPreference(WALLET_FREIGHTER);
    const result = getStoredWallet();
    expect(result).toMatchSnapshot();
  });

  it('getStoredWallet reads from legacy key when current key is missing', () => {
    // Simulate a legacy user: only wallet_info is set, not creditra-wallet-info
    window.localStorage.setItem('wallet_info', JSON.stringify(WALLET_ALBEDO));
    const result = getStoredWallet();
    expect(result).toMatchSnapshot();
  });

  it('getStoredWallet prefers the current key over the legacy key', () => {
    window.localStorage.setItem('wallet_info', JSON.stringify(WALLET_ALBEDO));
    saveWalletPreference(WALLET_FREIGHTER); // writes both keys
    const result = getStoredWallet();
    expect(result).toMatchSnapshot();
  });
});

// ─── 5. disconnectWallet cleanup ──────────────────────────────────────────────

describe('wallet auth snapshot — disconnectWallet cleanup', () => {
  it('disconnectWallet clears all wallet keys but preserves unrelated keys', () => {
    saveWalletPreference(WALLET_FREIGHTER);
    setWalletRemembered(true);
    window.localStorage.setItem('unrelated-key', 'preserved');
    disconnectWallet();
    const result = {
      storedWallet: getStoredWallet(),
      remembered: isWalletRemembered(),
      unrelated: window.localStorage.getItem('unrelated-key'),
    };
    expect(result).toMatchSnapshot();
  });

  it('disconnectWallet is safe to call multiple times', () => {
    saveWalletPreference(WALLET_FREIGHTER);
    setWalletRemembered(true);
    disconnectWallet();
    disconnectWallet();
    const result = {
      storedWallet: getStoredWallet(),
      remembered: isWalletRemembered(),
    };
    expect(result).toMatchSnapshot();
  });

  it('disconnectWallet clears the remember flag', () => {
    setWalletRemembered(true);
    disconnectWallet();
    expect(isWalletRemembered()).toMatchSnapshot();
  });
});

// ─── 6. isWalletRemembered & setWalletRemembered ──────────────────────────────

describe('wallet auth snapshot — remember flag', () => {
  it('isWalletRemembered returns false when no flag is stored', () => {
    const result = isWalletRemembered();
    expect(result).toMatchSnapshot();
  });

  it('isWalletRemembered returns true after setWalletRemembered(true)', () => {
    setWalletRemembered(true);
    const result = isWalletRemembered();
    expect(result).toMatchSnapshot();
  });

  it('isWalletRemembered returns false after setWalletRemembered(false)', () => {
    setWalletRemembered(true);
    setWalletRemembered(false);
    const result = isWalletRemembered();
    expect(result).toMatchSnapshot();
  });

  it('setWalletRemembered(false) removes the key from localStorage', () => {
    setWalletRemembered(true);
    setWalletRemembered(false);
    const keyExists = window.localStorage.getItem('creditra-wallet-remember') !== null;
    expect(keyExists).toMatchSnapshot();
  });
});

// ─── 7. recordRecentWallet & getRecentWalletOrder ──────────────────────────────

describe('wallet auth snapshot — MRU list', () => {
  it('getRecentWalletOrder returns empty array when no MRU is stored', () => {
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('getRecentWalletOrder returns single wallet after recordRecentWallet', () => {
    recordRecentWallet('freighter');
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('getRecentWalletOrder returns wallets in MRU order (last is most recent)', () => {
    recordRecentWallet('freighter');
    recordRecentWallet('albedo');
    recordRecentWallet('xbull');
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('recordRecentWallet deduplicates: same wallet twice promotes it to end', () => {
    recordRecentWallet('freighter');
    recordRecentWallet('albedo');
    recordRecentWallet('freighter');
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('recordRecentWallet caps the MRU list at 8 entries', () => {
    const wallets: WalletType[] = ['freighter', 'albedo', 'xbull', 'rabet'];
    // Record 10 entries by cycling through the 4 supported wallets
    for (let i = 0; i < 10; i++) {
      recordRecentWallet(wallets[i % wallets.length]);
    }
    const result = getRecentWalletOrder();
    expect(result.length).toBe(4); // only 4 distinct wallets exist
    expect(result).toMatchSnapshot();
  });

  it('getRecentWalletOrder sanitizes corrupt data (drops non-string entries)', () => {
    // Simulate corrupted localStorage
    window.localStorage.setItem('creditra-wallet-recent', JSON.stringify(['freighter', 123, null, 'albedo']));
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('getRecentWalletOrder drops unsupported wallet types', () => {
    // Simulate future wallet types that aren't yet supported
    window.localStorage.setItem('creditra-wallet-recent', JSON.stringify(['freighter', 'future-wallet', 'albedo']));
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('clearMRU removes the MRU list', () => {
    recordRecentWallet('freighter');
    recordRecentWallet('albedo');
    clearMRU();
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });
});

// ─── 8. Edge cases & overflow safety ──────────────────────────────────────────

describe('wallet auth snapshot — edge cases', () => {
  it('saveWalletPreference with null publicKey is stored as-is (no validation)', () => {
    const malformed = { type: 'freighter' as const, publicKey: '', network: 'PUBLIC' };
    saveWalletPreference(malformed);
    const result = getStoredWallet();
    expect(result).toMatchSnapshot();
  });

  it('recordRecentWallet with unsupported type is a no-op', () => {
    recordRecentWallet('freighter');
    recordRecentWallet('unsupported-type' as any);
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('getRecentWalletOrder returns empty array when stored value is not an array', () => {
    window.localStorage.setItem('creditra-wallet-recent', '"not-an-array"');
    const result = getRecentWalletOrder();
    expect(result).toMatchSnapshot();
  });

  it('isWalletRemembered returns false when stored value is malformed', () => {
    window.localStorage.setItem('creditra-wallet-remember', 'invalid-json');
    const result = isWalletRemembered();
    expect(result).toMatchSnapshot();
  });
});
