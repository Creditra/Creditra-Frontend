import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDetectedWallets } from '../useDetectedWallets';

const originalWallets = {
  freighter: window.freighter,
  albedo: window.albedo,
  xBullSDK: window.xBullSDK,
};

type WalletKey = 'freighter' | 'albedo' | 'xbull';

function installWallet(type: WalletKey) {
  if (type === 'freighter') {
    window.freighter = {
      getPublicKey: async () => 'GDUMMY',
      getNetwork: async () => 'TESTNET',
    };
  } else if (type === 'albedo') {
    window.albedo = { publicKey: async () => ({ pubkey: 'GDUMMY' }) };
  } else {
    window.xBullSDK = { getPublicKey: async () => 'GDUMMY' };
  }
}

function removeAllWallets() {
  window.freighter = undefined;
  window.albedo = undefined;
  window.xBullSDK = undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
  removeAllWallets();
});

afterEach(() => {
  vi.useRealTimers();
  window.freighter = originalWallets.freighter;
  window.albedo = originalWallets.albedo;
  window.xBullSDK = originalWallets.xBullSDK;
  vi.restoreAllMocks();
});

describe('useDetectedWallets', () => {
  it('detects no wallets when no globals are present', () => {
    const { result } = renderHook(() => useDetectedWallets());

    expect(result.current.detectedWallets).toEqual([]);
  });

  it('detects a single installed wallet', () => {
    installWallet('albedo');
    const { result } = renderHook(() => useDetectedWallets());

    expect(result.current.detectedWallets).toEqual(['albedo']);
  });

  it('detects several installed wallets in supported order', () => {
    installWallet('xbull');
    installWallet('albedo');
    installWallet('freighter');
    const { result } = renderHook(() => useDetectedWallets());

    expect(result.current.detectedWallets).toEqual(['freighter', 'albedo', 'xbull']);
  });

  it('picks up a wallet injected after mount via the 1000 ms re-check', () => {
    const { result } = renderHook(() => useDetectedWallets());
    expect(result.current.detectedWallets).toEqual([]);

    act(() => {
      installWallet('xbull');
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.detectedWallets).toEqual(['xbull']);
  });

  it('picks up a wallet injected after mount via a window focus event', () => {
    const { result } = renderHook(() => useDetectedWallets());
    expect(result.current.detectedWallets).toEqual([]);

    act(() => {
      installWallet('freighter');
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.detectedWallets).toEqual(['freighter']);
  });

  it('refresh() updates state when the installed set changes', () => {
    const { result } = renderHook(() => useDetectedWallets());

    act(() => {
      installWallet('albedo');
      result.current.refresh();
    });

    expect(result.current.detectedWallets).toEqual(['albedo']);
  });

  it('does not rerender when refresh() finds an unchanged set', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useDetectedWallets();
    });

    expect(renders).toBe(1);

    act(() => {
      result.current.refresh();
    });

    expect(renders).toBe(1);
    expect(result.current.detectedWallets).toEqual([]);

    act(() => {
      installWallet('albedo');
      result.current.refresh();
    });

    expect(renders).toBe(2);
    expect(result.current.detectedWallets).toEqual(['albedo']);
  });

  it('removes the focus listener and clears the timer on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useDetectedWallets());

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
  });

  it('stops reacting to focus events after unmount', () => {
    const { unmount } = renderHook(() => useDetectedWallets());
    unmount();

    expect(() => {
      installWallet('xbull');
      window.dispatchEvent(new Event('focus'));
    }).not.toThrow();
  });
});
