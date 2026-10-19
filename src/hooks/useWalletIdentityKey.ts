import { useWallet, walletIdentityKey } from '../context/WalletContext';

/**
 * Returns the stable identity key for the currently connected wallet,
 * or an empty string when disconnected or rendered outside `WalletProvider`.
 */
export function useWalletIdentityKey(): string {
  try {
    const { wallet } = useWallet();
    return walletIdentityKey(wallet) ?? '';
  } catch {
    return '';
  }
}
