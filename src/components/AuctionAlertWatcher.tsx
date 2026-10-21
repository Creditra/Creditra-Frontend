import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { MOCK_DUTCH_AUCTIONS } from '../data/mockDutchAuctions';
import { claimAlert, listAlerts, AUCTION_ALERTS_CHANGE_EVENT, AUCTION_ALERTS_STORAGE_KEY } from '../state/auctionAlerts';

export function calculateAuctionPriceStroops(auction: (typeof MOCK_DUTCH_AUCTIONS)[number], now: number): number {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (now <= start) return Math.round(auction.startPrice * 1e7);
  if (now >= end) return Math.round(auction.floorPrice * 1e7);
  const fraction = (now - start) / (end - start);
  return Math.round((auction.startPrice - fraction * (auction.startPrice - auction.floorPrice)) * 1e7);
}

export function AuctionAlertWatcher() {
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const check = () => {
      const alerts = listAlerts();
      for (const alert of alerts) {
        const auction = MOCK_DUTCH_AUCTIONS.find(item => item.id === alert.auctionId);
        if (!auction) {
          claimAlert(alert.auctionId);
          continue;
        }
        const now = Date.now();
        const ended = auction.status !== 'Active' || now >= new Date(auction.endTime).getTime();
        const reached = calculateAuctionPriceStroops(auction, now) <= alert.targetStroops;
        if (!ended && !reached) continue;
        if (!claimAlert(alert.auctionId)) continue;
        const endedMessage = `${auction.nft.name} ended before reaching your target`;
        const message = ended
          ? endedMessage
          : `${auction.nft.name} is now $${(calculateAuctionPriceStroops(auction, now) / 1e7).toFixed(2)}, at or below your $${(alert.targetStroops / 1e7).toFixed(2)} target`;
        addToast({
          type: ended ? 'info' : 'success', category: 'auction', title: ended ? 'Auction ended' : 'Target price reached', message,
          action: { label: 'View auction', onClick: () => navigate('/dutch-auctions') },
          actionDescriptor: { label: 'View auction', kind: 'route', to: '/dutch-auctions' },
        });
      }
      if (!listAlerts().length && interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const syncInterval = () => {
      if (listAlerts().length && !interval) interval = setInterval(check, 5000);
      if (!listAlerts().length && interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUCTION_ALERTS_STORAGE_KEY || event.key === null) syncInterval();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(AUCTION_ALERTS_CHANGE_EVENT, syncInterval);
    syncInterval();
    check();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUCTION_ALERTS_CHANGE_EVENT, syncInterval);
      if (interval) clearInterval(interval);
    };
  }, [addToast, navigate]);

  return null;
}