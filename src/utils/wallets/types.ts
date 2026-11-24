import type { WalletType } from '../../types/wallet';

export interface WalletConnection {
  publicKey: string;
  network: string;
}

export interface WalletAdapter {
  readonly type: WalletType;
  isInstalled: () => boolean;
  connect: () => Promise<WalletConnection>;
  getNetwork?: () => Promise<string>;
  switchNetwork?: (network: string) => Promise<void>;
  signTransaction?: (transaction: unknown) => Promise<string>;
}

export interface FreighterWallet {
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  signTransaction?: (
    xdr: string,
    options: { networkPassphrase: string; address?: string },
  ) => Promise<unknown>;
  switchNetwork?: (network: string) => Promise<void>;
  /** Newer Freighter builds expose the full account list (non-interactive). */
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface AlbedoWallet {
  publicKey: (options: Record<string, never>) => Promise<{ pubkey: string }>;
  tx?: (options: { xdr: string; network: string }) => Promise<unknown>;
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface XBullWallet {
  getPublicKey: () => Promise<string>;
  signXDR?: (xdr: string, network: string) => Promise<unknown>;
  signTransaction?: (xdr: string, network: string) => Promise<unknown>;
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface RabetWallet {
  connect: () => Promise<{ publicKey: string }>;
  signTransaction?: (xdr: string, network: string) => Promise<unknown>;
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

declare global {
  interface Window {
    freighter?: FreighterWallet;
    albedo?: AlbedoWallet;
    xBullSDK?: XBullWallet;
    rabet?: RabetWallet;
  }
}
