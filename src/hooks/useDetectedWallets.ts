import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletType } from '../utils/wallet';
import { isWalletInstalled } from '../utils/wallet';

const SUPPORTED_WALLETS: WalletType[] = ['freighter', 'albedo', 'xbull'];

function detectWallets(): WalletType[] {
  return SUPPORTED_WALLETS.filter((type) => {
    try {
      return isWalletInstalled(type);
    } catch {
      return false;
    }
  });
}

function sameWallets(a: WalletType[], b: WalletType[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((t) => setA.has(t));
}

export interface UseDetectedWalletsResult {
  detectedWallets: WalletType[];
  /** Re-run detection immediately (e.g. when the modal opens). */
  refresh: () => void;
}

export function useDetectedWallets(): UseDetectedWalletsResult {
  const [detectedWallets, setDetectedWallets] = useState<WalletType[]>(() => detectWallets());
  const stateRef = useRef<WalletType[]>(detectedWallets);

  // Sync detected wallets into state only when the set actually changes.
  const refresh = useCallback(() => {
    const next = detectWallets();
    if (!sameWallets(stateRef.current, next)) {
      stateRef.current = next;
      setDetectedWallets(next);
    }
  }, []);

  // Initial detection + re-check on window focus and once after mount for
  // late-injecting extensions. Listeners are removed on unmount.
  useEffect(() => {
    refresh();

    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);

    // Late-injecting extensions often add their globals after mount.
    const timer = window.setTimeout(() => refresh(), 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearTimeout(timer);
    };
  }, [refresh]);

  return { detectedWallets, refresh };
}

export default useDetectedWallets;
