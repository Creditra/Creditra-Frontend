import { afterEach, describe, expect, it } from 'vitest';
import { clearAlert, listAlerts, setAlert } from './auctionAlerts';

describe('auction alert storage', () => {
  afterEach(() => localStorage.clear());

  it('stores and removes a valid alert', () => {
    setAlert('DA-001', 2_000_000_000);
    expect(listAlerts()).toEqual([{ auctionId: 'DA-001', targetStroops: 2_000_000_000 }]);
    clearAlert('DA-001');
    expect(listAlerts()).toEqual([]);
  });

  it('ignores corrupt and malformed stored values', () => {
    localStorage.setItem('creditra_auction_alerts_v1', 'null');
    expect(listAlerts()).toEqual([]);
    localStorage.setItem('creditra_auction_alerts_v1', JSON.stringify([{ auctionId: 1, targetStroops: 'bad' }]));
    expect(listAlerts()).toEqual([]);
  });
});