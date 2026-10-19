import { canPurchase, PurchaseCheckResult } from '../lib/dutch-auction-purchase';
import type { DutchAuction } from '../types/dutchAuction';
import type { WalletInfo } from '../types/wallet';

describe('canPurchase utility', () => {
  const baseAuction: DutchAuction = {
    id: 'AUCTION1',
    seller: 'GDSSELLER',
    status: 'Active',
    startTime: new Date(Date.now() - 1000 * 60).toISOString(), // started 1 min ago
    endTime: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // ends in 10 min
    startPrice: 1000,
    floorPrice: 500,
    nft: { image: '', name: '', collection: '', tokenId: '' },
    // other required fields can be added as needed
  } as any;

  const walletInfo: WalletInfo = {
    publicKey: 'GD6W5Z37V5XF3HPH',
    network: 'TESTNET',
    type: 'freighter',
    // other context fields are not needed for canPurchase
  } as any;

  it('allows purchase when all preconditions are met', () => {
    const result = canPurchase(baseAuction, walletInfo, 'connected');
    expect(result.ok).toBe(true);
  });

  it('rejects when no wallet is connected', () => {
    const result = canPurchase(baseAuction, null, 'disconnected');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('no_wallet');
  });

  it('rejects when wallet on wrong network', () => {
    const wrongNetworkWallet = { ...walletInfo, network: 'PUBLIC' } as WalletInfo;
    const result = canPurchase(baseAuction, wrongNetworkWallet, 'connected');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('wrong_network');
  });

  it('rejects when user is the seller', () => {
    const sellerWallet = { ...walletInfo, publicKey: baseAuction.seller } as WalletInfo;
    const result = canPurchase(baseAuction, sellerWallet, 'connected');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('own_auction');
  });

  it('rejects when auction is not active (time out of bounds)', () => {
    const inactiveAuction = { ...baseAuction, endTime: new Date(Date.now() - 1000).toISOString() } as DutchAuction;
    const result = canPurchase(inactiveAuction, walletInfo, 'connected');
    expect(result.ok).toBe(false);
    expect((result as any).reason).toBe('not_active');
  });
});
