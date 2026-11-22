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
  switchNetwork?: (network: string) => Promise<void>;
}

export interface AlbedoWallet {
  publicKey: (options: Record<string, never>) => Promise<{ pubkey: string }>;
}

export interface XBullWallet {
  getPublicKey: () => Promise<string>;
}

export interface RabetWallet {
  connect: () => Promise<{ publicKey: string }>;
}

declare global {
  interface Window {
    freighter?: FreighterWallet;
    albedo?: AlbedoWallet;
    xBullSDK?: XBullWallet;
    rabet?: RabetWallet;
  }
}
