import type { WalletAdapter } from './types';

export const freighterAdapter: WalletAdapter = {
  type: 'freighter',
  isInstalled: () => Boolean(window.freighter),
  connect: async () => {
    if (!window.freighter) {
      throw new Error('Freighter wallet not found');
    }

    const publicKey = await window.freighter.getPublicKey();
    const network = await window.freighter.getNetwork();

    if (network !== 'PUBLIC' && network !== 'TESTNET') {
      throw {
        type: 'wrong_network',
        message: 'Please switch to Stellar network in your wallet.',
      };
    }

    return { publicKey, network };
  },
  getNetwork: async () => {
    if (!window.freighter) return 'PUBLIC';
    return window.freighter.getNetwork();
  },
  get switchNetwork() {
    if (!window.freighter?.switchNetwork) return undefined;
    return async (network: string) => {
      await window.freighter?.switchNetwork?.(network);
    };
  },
};
