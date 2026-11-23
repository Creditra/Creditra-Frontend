import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletType } from '../types/wallet';
import { connectWallet } from './wallet';

const SECRET_SEED = 'SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY';
const INVALID_ADDRESS_MESSAGE = 'Your wallet returned an invalid account address';
const WALLET_TYPES: WalletType[] = ['freighter', 'albedo', 'xbull', 'rabet'];

const originalWallets = {
  freighter: window.freighter,
  albedo: window.albedo,
  xBullSDK: window.xBullSDK,
  rabet: window.rabet,
};

function setWalletResult(type: WalletType) {
  if (type === 'freighter') {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue(SECRET_SEED),
      getNetwork: vi.fn(),
    };
  } else if (type === 'albedo') {
    window.albedo = { publicKey: vi.fn().mockResolvedValue({ pubkey: SECRET_SEED }) };
  } else if (type === 'xbull') {
    window.xBullSDK = { getPublicKey: vi.fn().mockResolvedValue(SECRET_SEED) };
  } else {
    window.rabet = { connect: vi.fn().mockResolvedValue({ publicKey: SECRET_SEED }) };
  }
}

afterEach(() => {
  window.freighter = originalWallets.freighter;
  window.albedo = originalWallets.albedo;
  window.xBullSDK = originalWallets.xBullSDK;
  window.rabet = originalWallets.rabet;
  vi.restoreAllMocks();
});

describe('connectWallet StrKey validation', () => {
  it.each(WALLET_TYPES)(
    'rejects an invalid account returned by %s without exposing it',
    async (type) => {
      setWalletResult(type);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(connectWallet(type)).rejects.toMatchObject({
        type: 'connection_failed',
        message: INVALID_ADDRESS_MESSAGE,
      });
      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(SECRET_SEED);
      expect(window.localStorage.length).toBe(0);
    },
  );
});
