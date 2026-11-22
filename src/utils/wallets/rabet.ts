import type { WalletAdapter } from './types';

export const rabetAdapter: WalletAdapter = {
  type: 'rabet',
  isInstalled: () => Boolean(window.rabet),
  connect: async () => {
    if (!window.rabet) {
      throw new Error('Rabet wallet not found');
    }

    const result = await window.rabet.connect();
    return { publicKey: result.publicKey, network: 'PUBLIC' };
  },
};
