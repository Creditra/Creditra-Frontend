import { useWallet } from '@/context/WalletContext';

/**
 * Returns a stable string identifying the currently connected wallet,
 * or null if no wallet is connected.
 */
export function useWalletIdentityKey(): string | null {
  try {
    const { wallet } = useWallet();
    return wallet?.publicKey ?? null;
  } catch {
    return null;
  }
}
