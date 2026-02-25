import { WalletType, WalletInfo, WalletError } from '../types/wallet';

declare global {
  interface Window {
    freighter?: any;
    albedo?: any;
    xBullSDK?: any;
    rabet?: any;
  }
}

export const isWalletInstalled = (type: WalletType): boolean => {
  if (type === 'freighter') return !!window.freighter;
  if (type === 'albedo') return !!window.albedo;
  if (type === 'xbull') return !!window.xBullSDK;
  if (type === 'rabet') return !!window.rabet;
  return false;
};

export const connectWallet = async (type: WalletType): Promise<WalletInfo> => {
  if (!isWalletInstalled(type)) {
    const walletNames: Record<WalletType, string> = {
      freighter: 'Freighter',
      albedo: 'Albedo',
      xbull: 'xBull',
      rabet: 'Rabet'
    };
    throw {
      type: 'not_found',
      message: `${walletNames[type]} wallet not found. Please install the extension.`
    } as WalletError;
  }

  try {
    if (type === 'freighter') {
      const publicKey = await window.freighter.getPublicKey();
      const network = await window.freighter.getNetwork();
      
      if (network !== 'PUBLIC' && network !== 'TESTNET') {
        throw {
          type: 'wrong_network',
          message: 'Please switch to Stellar network in your wallet.'
        } as WalletError;
      }

      return { type, publicKey, network };
    }

    if (type === 'albedo') {
      const result = await window.albedo.publicKey({});
      return { 
        type, 
        publicKey: result.pubkey, 
        network: 'PUBLIC' 
      };
    }

    if (type === 'xbull') {
      const publicKey = await window.xBullSDK.getPublicKey();
      return { 
        type, 
        publicKey, 
        network: 'PUBLIC' 
      };
    }

    if (type === 'rabet') {
      const result = await window.rabet.connect();
      return { 
        type, 
        publicKey: result.publicKey, 
        network: 'PUBLIC' 
      };
    }

    throw new Error('Unsupported wallet type');
  } catch (error: any) {
    if (error.type) throw error;
    
    throw {
      type: 'connection_failed',
      message: error.message || 'Failed to connect wallet. Please try again.'
    } as WalletError;
  }
};

export const disconnectWallet = () => {
  localStorage.removeItem('wallet_info');
  localStorage.removeItem('wallet_preference');
};

export const saveWalletPreference = (walletInfo: WalletInfo) => {
  localStorage.setItem('wallet_info', JSON.stringify(walletInfo));
  localStorage.setItem('wallet_preference', walletInfo.type);
};

export const getStoredWallet = (): WalletInfo | null => {
  const stored = localStorage.getItem('wallet_info');
  return stored ? JSON.parse(stored) : null;
};
