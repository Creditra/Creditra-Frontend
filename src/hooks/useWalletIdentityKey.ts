import { useWallet } from "../context/WalletContext";
import { walletIdentityKey } from "../context/WalletContext";

/**
 * Returns a stable identity key for the currently connected wallet.
 * Used by ConfirmationStep to scope risk education state to the wallet.
 *
 * Returns null when no wallet is connected.
 */
export function useWalletIdentityKey(): string | null {
  const { wallet } = useWallet();
  return walletIdentityKey(wallet);
}
