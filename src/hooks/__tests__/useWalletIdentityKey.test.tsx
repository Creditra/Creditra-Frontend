import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletInfo } from '@/types/wallet';
import { useWalletIdentityKey } from '../useWalletIdentityKey';

const { mockUseWallet } = vi.hoisted(() => ({ mockUseWallet: vi.fn() }));

vi.mock('@/context/WalletContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/WalletContext')>(
    '@/context/WalletContext',
  );
  return {
    ...actual,
    useWallet: mockUseWallet,
  };
});

const connectedWallet: WalletInfo = {
  type: 'freighter',
  publicKey: 'GABC123',
  network: 'testnet',
};

const setWallet = (wallet: WalletInfo | null) => {
  mockUseWallet.mockReturnValue({ wallet });
};

describe('useWalletIdentityKey', () => {
  beforeEach(() => {
    mockUseWallet.mockReset();
  });

  it('returns null when no wallet is connected', () => {
    setWallet(null);

    const { result } = renderHook(() => useWalletIdentityKey());

    expect(result.current).toBeNull();
  });

  it('returns the exact type:publicKey:network key when connected', () => {
    setWallet(connectedWallet);

    const { result } = renderHook(() => useWalletIdentityKey());

    expect(result.current).toBe('freighter:GABC123:testnet');
  });

  it('updates when the network or publicKey changes', () => {
    setWallet(connectedWallet);
    const { result, rerender } = renderHook(() => useWalletIdentityKey());
    expect(result.current).toBe('freighter:GABC123:testnet');

    setWallet({ ...connectedWallet, network: 'pubnet' });
    rerender();
    expect(result.current).toBe('freighter:GABC123:pubnet');

    setWallet({ ...connectedWallet, publicKey: 'GXYZ789' });
    rerender();
    expect(result.current).toBe('freighter:GXYZ789:testnet');
  });

  it('stays stable across rerenders with an equal wallet object', () => {
    setWallet(connectedWallet);
    const { result, rerender } = renderHook(() => useWalletIdentityKey());
    const initialKey = result.current;
    expect(initialKey).toBe('freighter:GABC123:testnet');

    setWallet({ ...connectedWallet });
    rerender();

    expect(result.current).toBe(initialKey);
  });
});
