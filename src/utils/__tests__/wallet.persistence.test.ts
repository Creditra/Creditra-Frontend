/**
 * wallet — storage minimisation
 *
 * Covers the contract that the wallet module persists the wallet **type**
 * only:
 *   - `saveWalletPreference` writes `{ v: 2, type }` and never an address.
 *   - The v1 → v2 migration reduces old records to their type, deletes the
 *     legacy `wallet_info` / `wallet_preference` keys, and is idempotent.
 *   - A record with an unsupported type is dropped instead of being used.
 *   - No value written by the module ever contains a Stellar public key.
 *   - `disconnectWallet` keeps the MRU list (recency is not session state).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWalletPreference,
  getStoredWallet,
  disconnectWallet,
  recordRecentWallet,
  getRecentWalletOrder,
} from '../wallet';

const STORAGE_KEY_INFO = 'creditra-wallet-info';
const STORAGE_KEY_INFO_LEGACY = 'wallet_info';
const STORAGE_KEY_PREFERENCE_LEGACY = 'wallet_preference';
const STORAGE_KEY_REMEMBER = 'creditra-wallet-remember';

/** Syntactically valid Stellar public key: `G` + 55 base32 characters. */
const PUBLIC_KEY = `G${'A'.repeat(55)}`;
const STELLAR_KEY_PATTERN = /G[A-Z2-7]{55}/;

const WALLET_INFO = {
  type: 'freighter' as const,
  publicKey: PUBLIC_KEY,
  network: 'PUBLIC',
};

function storedInfo(): unknown {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY_INFO) ?? 'null');
}

function allStorageValues(): string[] {
  return Object.keys(window.localStorage).map(
    (key) => window.localStorage.getItem(key) ?? '',
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('saveWalletPreference — type-only persistence', () => {
  // 1
  it('writes { v: 2, type } with no public key', () => {
    saveWalletPreference(WALLET_INFO);

    expect(storedInfo()).toEqual({ v: 2, type: 'freighter' });
    expect(window.localStorage.getItem(STORAGE_KEY_INFO)).not.toContain('publicKey');
    expect(window.localStorage.getItem(STORAGE_KEY_INFO)).not.toContain(PUBLIC_KEY);
  });

  // 2
  it('does not write the legacy wallet_info key', () => {
    saveWalletPreference(WALLET_INFO);

    expect(window.localStorage.getItem(STORAGE_KEY_INFO_LEGACY)).toBeNull();
  });

  it('removes a legacy wallet_info mirror left by an older release', () => {
    window.localStorage.setItem(STORAGE_KEY_INFO_LEGACY, JSON.stringify(WALLET_INFO));

    saveWalletPreference(WALLET_INFO);

    expect(window.localStorage.getItem(STORAGE_KEY_INFO_LEGACY)).toBeNull();
  });
});

describe('getStoredWallet — v1 → v2 migration', () => {
  // 3
  it('reduces a v1 record to its type and deletes the legacy keys', () => {
    window.localStorage.setItem(STORAGE_KEY_INFO, JSON.stringify(WALLET_INFO));
    window.localStorage.setItem(STORAGE_KEY_INFO_LEGACY, JSON.stringify(WALLET_INFO));
    window.localStorage.setItem(
      STORAGE_KEY_PREFERENCE_LEGACY,
      JSON.stringify('freighter'),
    );

    expect(getStoredWallet()).toEqual({ v: 2, type: 'freighter' });
    expect(storedInfo()).toEqual({ v: 2, type: 'freighter' });
    expect(window.localStorage.getItem(STORAGE_KEY_INFO_LEGACY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_PREFERENCE_LEGACY)).toBeNull();
  });

  it('is idempotent — repeated reads keep the same v2 record', () => {
    window.localStorage.setItem(STORAGE_KEY_INFO, JSON.stringify(WALLET_INFO));

    const first = getStoredWallet();
    const second = getStoredWallet();

    expect(first).toEqual({ v: 2, type: 'freighter' });
    expect(second).toEqual(first);
    expect(storedInfo()).toEqual({ v: 2, type: 'freighter' });
  });

  it('falls back to the legacy wallet_info key when the current one is absent', () => {
    window.localStorage.setItem(STORAGE_KEY_INFO_LEGACY, JSON.stringify(WALLET_INFO));

    expect(getStoredWallet()).toEqual({ v: 2, type: 'freighter' });
    expect(storedInfo()).toEqual({ v: 2, type: 'freighter' });
    expect(window.localStorage.getItem(STORAGE_KEY_INFO_LEGACY)).toBeNull();
  });

  // 4
  it('drops a record whose type is not supported', () => {
    window.localStorage.setItem(
      STORAGE_KEY_INFO,
      JSON.stringify({ v: 2, type: 'metamask' }),
    );
    window.localStorage.setItem(
      STORAGE_KEY_INFO_LEGACY,
      JSON.stringify({ type: 'metamask' }),
    );

    expect(getStoredWallet()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_INFO)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_INFO_LEGACY)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredWallet()).toBeNull();
  });
});

describe('no address ever reaches localStorage', () => {
  // 7
  it('leaves no G... key in any stored value across connect, reload and disconnect', () => {
    // Connect.
    saveWalletPreference(WALLET_INFO);
    recordRecentWallet('freighter');
    expect(getStoredWallet()?.type).toBe('freighter');

    // Reload with a v1 record still on disk (migration path).
    window.localStorage.setItem(STORAGE_KEY_INFO, JSON.stringify(WALLET_INFO));
    window.localStorage.setItem(STORAGE_KEY_INFO_LEGACY, JSON.stringify(WALLET_INFO));
    window.localStorage.setItem(
      STORAGE_KEY_PREFERENCE_LEGACY,
      JSON.stringify('freighter'),
    );
    expect(getStoredWallet()?.type).toBe('freighter');

    for (const value of allStorageValues()) {
      expect(value).not.toMatch(STELLAR_KEY_PATTERN);
    }

    // Disconnect.
    disconnectWallet();

    for (const value of allStorageValues()) {
      expect(value).not.toMatch(STELLAR_KEY_PATTERN);
    }
  });
});

describe('disconnectWallet', () => {
  // 8
  it('retains the MRU list while clearing the session and remember flag', () => {
    saveWalletPreference(WALLET_INFO);
    recordRecentWallet('freighter');
    window.localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');

    disconnectWallet();

    expect(window.localStorage.getItem(STORAGE_KEY_INFO)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_REMEMBER)).toBeNull();
    expect(getRecentWalletOrder()).toEqual(['freighter']);
  });
});
