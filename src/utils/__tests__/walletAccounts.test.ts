import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLastAccount,
  disconnectWallet,
  getAccounts,
  getLastAccount,
  saveLastAccount,
} from '../wallet';

const ACCOUNT_A = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const ACCOUNT_B = 'GB7KKHHVYLDIZEKYJPAJUOTBE5E3NJAXPSDZK7O6O44WR3EBRO5HRPVT';

const originalFreighter = window.freighter;
const originalAlbedo = window.albedo;

beforeEach(() => {
  window.localStorage.clear();
  window.freighter = undefined;
  window.albedo = undefined;
});

afterEach(() => {
  window.freighter = originalFreighter;
  window.albedo = originalAlbedo;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('getAccounts', () => {
  it('reads Freighter getAddresses({ addresses }) and drops invalid keys', async () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue(ACCOUNT_A),
      getNetwork: vi.fn().mockResolvedValue('PUBLIC'),
      getAddresses: vi.fn().mockResolvedValue({ addresses: [ACCOUNT_A, 'not-a-key', ACCOUNT_B] }),
    };

    await expect(getAccounts('freighter')).resolves.toEqual([ACCOUNT_A, ACCOUNT_B]);
  });

  it('falls back to getPublicKey on older Freighter builds', async () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue(ACCOUNT_A),
      getNetwork: vi.fn().mockResolvedValue('PUBLIC'),
    };

    await expect(getAccounts('freighter')).resolves.toEqual([ACCOUNT_A]);
  });

  it('falls through getAddresses → getAccounts → getPublicKey', async () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue(ACCOUNT_A),
      getNetwork: vi.fn().mockResolvedValue('PUBLIC'),
      getAddresses: vi.fn().mockRejectedValue(new Error('not supported')),
      getAccounts: vi.fn().mockResolvedValue([ACCOUNT_B]),
    };

    await expect(getAccounts('freighter')).resolves.toEqual([ACCOUNT_B]);
  });

  it('returns [] for a wallet with no listing API rather than prompting', async () => {
    window.albedo = {
      publicKey: vi.fn().mockResolvedValue({ pubkey: ACCOUNT_A }),
    };

    await expect(getAccounts('albedo')).resolves.toEqual([]);
    expect(window.albedo.publicKey).not.toHaveBeenCalled();
  });

  it('returns [] when the wallet is not installed', async () => {
    await expect(getAccounts('freighter')).resolves.toEqual([]);
  });
});

describe('last selected account persistence', () => {
  it('round-trips an account for the matching wallet type', () => {
    saveLastAccount('freighter', ACCOUNT_B);

    expect(getLastAccount('freighter')).toBe(ACCOUNT_B);
    expect(getLastAccount('xbull')).toBeNull();
  });

  it('ignores invalid addresses', () => {
    saveLastAccount('freighter', 'nope');

    expect(getLastAccount('freighter')).toBeNull();
  });

  it('clears on demand and on disconnect', () => {
    saveLastAccount('freighter', ACCOUNT_B);
    clearLastAccount();
    expect(getLastAccount('freighter')).toBeNull();

    saveLastAccount('freighter', ACCOUNT_A);
    disconnectWallet();
    expect(getLastAccount('freighter')).toBeNull();
  });
});
