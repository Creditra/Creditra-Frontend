import { afterEach, describe, expect, it, vi } from 'vitest';
import { albedoAdapter } from './albedo';
import { freighterAdapter } from './freighter';
import { rabetAdapter } from './rabet';
import { xbullAdapter } from './xbull';

const originalWallets = {
  freighter: window.freighter,
  albedo: window.albedo,
  xBullSDK: window.xBullSDK,
  rabet: window.rabet,
};

afterEach(() => {
  window.freighter = originalWallets.freighter;
  window.albedo = originalWallets.albedo;
  window.xBullSDK = originalWallets.xBullSDK;
  window.rabet = originalWallets.rabet;
});

describe('wallet adapters', () => {
  it('reports Freighter installation and connects', async () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue('GABC'),
      getNetwork: vi.fn().mockResolvedValue('TESTNET'),
    };

    expect(freighterAdapter.isInstalled()).toBe(true);
    await expect(freighterAdapter.connect()).resolves.toEqual({
      publicKey: 'GABC',
      network: 'TESTNET',
    });
  });

  it('rejects unsupported Freighter networks', async () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue('GABC'),
      getNetwork: vi.fn().mockResolvedValue('UNSUPPORTED'),
    };

    await expect(freighterAdapter.connect()).rejects.toMatchObject({
      type: 'wrong_network',
    });
  });

  it('reports network switching only when Freighter exposes it', () => {
    window.freighter = {
      getPublicKey: vi.fn().mockResolvedValue('GABC'),
      getNetwork: vi.fn().mockResolvedValue('TESTNET'),
    };
    expect(freighterAdapter.switchNetwork).toBeUndefined();

    const switchNetwork = vi.fn().mockResolvedValue(undefined);
    window.freighter.switchNetwork = switchNetwork;
    expect(freighterAdapter.switchNetwork).toBeTypeOf('function');
  });

  it('connects Albedo', async () => {
    window.albedo = {
      publicKey: vi.fn().mockResolvedValue({ pubkey: 'GABC' }),
    };

    expect(albedoAdapter.isInstalled()).toBe(true);
    await expect(albedoAdapter.connect()).resolves.toEqual({
      publicKey: 'GABC',
      network: 'PUBLIC',
    });
  });

  it('connects xBull', async () => {
    window.xBullSDK = {
      getPublicKey: vi.fn().mockResolvedValue('GABC'),
    };

    expect(xbullAdapter.isInstalled()).toBe(true);
    await expect(xbullAdapter.connect()).resolves.toEqual({
      publicKey: 'GABC',
      network: 'PUBLIC',
    });
  });

  it('connects Rabet', async () => {
    window.rabet = {
      connect: vi.fn().mockResolvedValue({ publicKey: 'GABC' }),
    };

    expect(rabetAdapter.isInstalled()).toBe(true);
    await expect(rabetAdapter.connect()).resolves.toEqual({
      publicKey: 'GABC',
      network: 'PUBLIC',
    });
  });
});
