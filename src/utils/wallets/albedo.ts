import type { WalletAdapter } from './types';

export const albedoAdapter: WalletAdapter = {
  type: 'albedo',
  isInstalled: () => Boolean(window.albedo),
  connect: async () => {
    if (!window.albedo) {
      throw new Error('Albedo wallet not found');
    }

    const result = await window.albedo.publicKey({});
    return { publicKey: result.pubkey, network: 'PUBLIC' };
  },
};
