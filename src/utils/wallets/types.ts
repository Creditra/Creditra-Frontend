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
  signTransaction?: (
    xdr: string,
    opts?: { networkPassphrase?: string; network?: string; accountToSign?: string },
  ) => Promise<string | { signedTxXdr?: string; error?: string }>;
  /** Newer Freighter builds expose the full account list (non-interactive). */
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface AlbedoWallet {
  publicKey: (options: Record<string, never>) => Promise<{ pubkey: string }>;
  tx?: (params: {
    xdr: string;
    network?: string;
    submit?: boolean;
  }) => Promise<{ signed_envelope_xdr: string; tx_hash?: string }>;
  tx?: (options: { xdr: string; network: string }) => Promise<unknown>;
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface XBullWallet {
  getPublicKey: () => Promise<string>;
  signXDR?: (
    xdr: string,
    opts?: { network?: string; publicKey?: string },
  ) => Promise<string | { xdr?: string }>;
  signXDR?: (xdr: string, network: string) => Promise<unknown>;
  signTransaction?: (xdr: string, network: string) => Promise<unknown>;
  getAddresses?: () => Promise<string[] | { addresses?: string[] }>;
  getAccounts?: () => Promise<string[]>;
}

export interface RabetWallet {
  connect: () => Promise<{ publicKey: string }>;
  sign?: (
    xdr: string,
    network: 'mainnet' | 'testnet',
  ) => Promise<{ xdr?: string; error?: string } | string>;
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
