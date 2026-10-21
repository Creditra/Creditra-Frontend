import { readJson, writeJson } from '../utils/storage';

const STORAGE_KEY = 'creditra_auction_alerts_v1';
const FIRED_KEY = 'creditra_auction_alerts_fired_v1';
export const AUCTION_ALERTS_CHANGE_EVENT = 'creditra:auction-alerts-change';

function notifyChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUCTION_ALERTS_CHANGE_EVENT));
}

export interface AuctionAlert {
  auctionId: string;
  targetStroops: number;
}

function validAlerts(value: unknown): AuctionAlert[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AuctionAlert =>
    !!entry && typeof entry === 'object' &&
    typeof (entry as AuctionAlert).auctionId === 'string' &&
    Number.isSafeInteger((entry as AuctionAlert).targetStroops) &&
    (entry as AuctionAlert).targetStroops >= 0,
  );
}

export function listAlerts(): AuctionAlert[] {
  return validAlerts(readJson<unknown>(STORAGE_KEY, []));
}

export function setAlert(auctionId: string, targetStroops: number): void {
  if (!auctionId || !Number.isSafeInteger(targetStroops) || targetStroops < 0) return;
  const fired = readJson<unknown>(FIRED_KEY, []);
  const ids = Array.isArray(fired) ? fired.filter((id): id is string => typeof id === 'string') : [];
  writeJson(FIRED_KEY, ids.filter(id => id !== auctionId));
  writeJson(STORAGE_KEY, [...listAlerts().filter(alert => alert.auctionId !== auctionId), { auctionId, targetStroops }]);
  notifyChange();
}

export function clearAlert(auctionId: string): void {
  writeJson(STORAGE_KEY, listAlerts().filter(alert => alert.auctionId !== auctionId));
  notifyChange();
}

export function claimAlert(auctionId: string): boolean {
  const fired = readJson<unknown>(FIRED_KEY, []);
  const ids = Array.isArray(fired) ? fired.filter((id): id is string => typeof id === 'string') : [];
  if (ids.includes(auctionId)) return false;
  writeJson(FIRED_KEY, [...ids, auctionId]);
  clearAlert(auctionId);
  return true;
}

export const AUCTION_ALERTS_STORAGE_KEY = STORAGE_KEY;