import type { WalletAdapter } from './types';

export const xbullAdapter: WalletAdapter = {
  type: 'xbull',
  isInstalled: () => Boolean(window.xBullSDK),
  connect: async () => {
    if (!window.xBullSDK) {
      throw new Error('xBull wallet not found');
    }

    return {
      publicKey: await window.xBullSDK.getPublicKey(),
      network: 'PUBLIC',
    };
  },
};
