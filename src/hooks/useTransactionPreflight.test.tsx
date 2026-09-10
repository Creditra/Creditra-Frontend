import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionPreflight } from './useTransactionPreflight';
import * as walletUtils from '../utils/wallet';
import type { WalletInfo } from '../types/wallet';

vi.mock('../utils/wallet', async () => {
  const actual = await vi.importActual<typeof import('../utils/wallet')>('../utils/wallet');
  return {
    ...actual,
    switchNetwork: vi.fn(),
  };
});

describe('useTransactionPreflight hook', () => {
  const validWallet: WalletInfo = {
    type: 'freighter',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    network: 'TESTNET',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows signing when network and account match', () => {
    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: validWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        expectedAccount: validWallet.publicKey,
      }),
    );

    expect(result.current.canSign).toBe(true);
    expect(result.current.preflight.status).toBe('ready');
    expect(result.current.preflight.isNetworkMatch).toBe(true);
    expect(result.current.preflight.isAccountMatch).toBe(true);
  });

  it('blocks signing when wallet is disconnected', () => {
    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: null,
        statusOverride: 'disconnected',
        expectedNetwork: 'TESTNET',
      }),
    );

    expect(result.current.canSign).toBe(false);
    expect(result.current.preflight.status).toBe('disconnected');
    expect(result.current.preflight.blockReason).toContain('disconnected');
  });

  it('blocks signing when connected to the wrong network', () => {
    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: wrongNetworkWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
      }),
    );

    expect(result.current.canSign).toBe(false);
    expect(result.current.preflight.status).toBe('wrong_network');
    expect(result.current.preflight.isNetworkMatch).toBe(false);
  });

  it('blocks signing when expected account does not match connected account', () => {
    const differentAccount = 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC';

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: validWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        expectedAccount: differentAccount,
      }),
    );

    expect(result.current.canSign).toBe(false);
    expect(result.current.preflight.status).toBe('account_mismatch');
    expect(result.current.preflight.isAccountMatch).toBe(false);
  });

  it('blocks signing when wallet identity is stale', () => {
    const initialKey = 'freighter:G_INITIAL_KEY:TESTNET';

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: validWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        initialIdentityKey: initialKey,
      }),
    );

    expect(result.current.canSign).toBe(false);
    expect(result.current.preflight.status).toBe('stale_identity');
    expect(result.current.preflight.isIdentityFresh).toBe(false);

    act(() => {
      result.current.acknowledgeIdentityChange();
    });

    expect(result.current.canSign).toBe(true);
    expect(result.current.preflight.status).toBe('ready');
  });

  it('guarantees switch failures do not auto-submit the transaction', async () => {
    const executeSpy = vi.fn();
    vi.mocked(walletUtils.switchNetwork).mockRejectedValueOnce(
      new Error('User rejected network switch request'),
    );

    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: wrongNetworkWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        onExecuteTransaction: executeSpy,
      }),
    );

    expect(result.current.canSign).toBe(false);

    let switchSuccess = false;
    await act(async () => {
      switchSuccess = await result.current.handleSwitchNetwork();
    });

    expect(switchSuccess).toBe(false);
    expect(walletUtils.switchNetwork).toHaveBeenCalledWith('freighter', 'TESTNET');
    expect(result.current.switchError).toBe('User rejected network switch request');
    expect(executeSpy).not.toHaveBeenCalled();
    expect(result.current.canSign).toBe(false);
  });

  it('does not auto-submit transaction on successful network switch without user action', async () => {
    const executeSpy = vi.fn();
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(walletUtils.switchNetwork).mockResolvedValueOnce(undefined);

    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: wrongNetworkWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        refreshIdentityOverride: refreshSpy,
        onExecuteTransaction: executeSpy,
      }),
    );

    let switchSuccess = false;
    await act(async () => {
      switchSuccess = await result.current.handleSwitchNetwork();
    });

    expect(switchSuccess).toBe(true);
    expect(refreshSpy).toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('executeSafeSubmit halts and refuses to submit when preflight is blocked', async () => {
    const executeSpy = vi.fn();
    const wrongNetworkWallet: WalletInfo = {
      ...validWallet,
      network: 'PUBLIC',
    };

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: wrongNetworkWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        onExecuteTransaction: executeSpy,
      }),
    );

    let submitResult = false;
    await act(async () => {
      submitResult = await result.current.executeSafeSubmit();
    });

    expect(submitResult).toBe(false);
    expect(executeSpy).not.toHaveBeenCalled();
    expect(result.current.executionError).toContain('Wrong network');
  });

  it('executeSafeSubmit calls onExecuteTransaction when preflight is valid', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useTransactionPreflight({
        walletOverride: validWallet,
        statusOverride: 'connected',
        expectedNetwork: 'TESTNET',
        onExecuteTransaction: executeSpy,
      }),
    );

    let submitResult = false;
    await act(async () => {
      submitResult = await result.current.executeSafeSubmit();
    });

    expect(submitResult).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(result.current.executionError).toBeNull();
  });
});
