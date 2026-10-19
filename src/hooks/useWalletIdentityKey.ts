import { useContext } from "react";
import { WalletContext } from "../context/WalletContext";

/**
 * Returns a stable identity key for the currently connected wallet.
 * Used by ConfirmationStep to scope risk education state to the wallet.
 */
export function useWalletIdentityKey(): string | null {
  const context = useContext(WalletContext);
  
  // Safely access the wallet address/public key from the context
  const publicKey = context?.address || context?.publicKey;
  
  return publicKey || null;
}
