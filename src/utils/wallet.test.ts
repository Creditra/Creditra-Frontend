import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletType } from '../types/wallet';
import { connectWallet, signTransaction } from './wallet';

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

describe('signTransaction', () => {
  const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
  const UNSIGNED_XDR = 'AAAAAgAAAABunsigned==';
  const SIGNED_XDR = 'AAAAAgAAAABsigned==';

  it('signs via Freighter signTransaction', async () => {
    const signMock = vi.fn().mockResolvedValue(SIGNED_XDR);
    window.freighter = {
      getPublicKey: vi.fn(),
      getNetwork: vi.fn(),
      signTransaction: signMock,
    };

    const result = await signTransaction('freighter', UNSIGNED_XDR, TESTNET_PASSPHRASE);
    expect(result).toBe(SIGNED_XDR);
    expect(signMock).toHaveBeenCalledWith(UNSIGNED_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
  });

  it('signs via Albedo tx', async () => {
    const txMock = vi.fn().mockResolvedValue({ signed_envelope_xdr: SIGNED_XDR });
    window.albedo = {
      publicKey: vi.fn(),
      tx: txMock,
    };

    const result = await signTransaction('albedo', UNSIGNED_XDR, TESTNET_PASSPHRASE);
    expect(result).toBe(SIGNED_XDR);
    expect(txMock).toHaveBeenCalledWith({
      xdr: UNSIGNED_XDR,
      network: 'testnet',
      submit: false,
    });
  });

  it('signs via xBull signXDR', async () => {
    const signXDRMock = vi.fn().mockResolvedValue(SIGNED_XDR);
    window.xBullSDK = {
      getPublicKey: vi.fn(),
      signXDR: signXDRMock,
    };

    const result = await signTransaction('xbull', UNSIGNED_XDR, TESTNET_PASSPHRASE);
    expect(result).toBe(SIGNED_XDR);
    expect(signXDRMock).toHaveBeenCalledWith(UNSIGNED_XDR, {
      network: TESTNET_PASSPHRASE,
    });
  });

  it('signs via Rabet sign', async () => {
    const signMock = vi.fn().mockResolvedValue({ xdr: SIGNED_XDR });
    window.rabet = {
      connect: vi.fn(),
      sign: signMock,
    };

    const result = await signTransaction('rabet', UNSIGNED_XDR, TESTNET_PASSPHRASE);
    expect(result).toBe(SIGNED_XDR);
    expect(signMock).toHaveBeenCalledWith(UNSIGNED_XDR, 'testnet');
  });

  it('classifies user rejection as user_rejected WalletConnectError', async () => {
    window.freighter = {
      getPublicKey: vi.fn(),
      getNetwork: vi.fn(),
      signTransaction: vi.fn().mockRejectedValue(new Error('User declined access')),
    };

    await expect(
      signTransaction('freighter', UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).rejects.toMatchObject({
      type: 'user_rejected',
    });
  });
});
