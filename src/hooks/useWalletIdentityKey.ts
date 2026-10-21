/**
 * useWalletIdentityKey — stable identity key for the connected wallet.
 *
 * Returns `type:publicKey:network` (the same value produced by
 * `walletIdentityKey` in WalletContext) or `null` when no wallet is connected.
 *
 * Consumers use the key to scope persisted state per wallet. The confirm-step
 * risk-education nudge in `ConfirmationStep`, for example, keys its
 * acknowledgement by wallet identity so a new borrower on the same browser
 * does not inherit another wallet's state.
 */
import { useWallet, walletIdentityKey } from '../context/WalletContext';

export function useWalletIdentityKey(): string | null {
  const { wallet } = useWallet();
  return wallet ? walletIdentityKey(wallet) : null;
}
