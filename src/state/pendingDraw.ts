export interface PendingDrawIntent {
  lineId: string;
  amountCents: number;
  quoteId?: string;
  queuedAt: number;
}

const PENDING_DRAW_KEY = 'creditra_pending_draw_intent';
export const PENDING_DRAW_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export function savePendingDrawIntent(intent: PendingDrawIntent): void {
  try {
    localStorage.setItem(PENDING_DRAW_KEY, JSON.stringify(intent));
  } catch (e) {
    console.error('Failed to save pending draw intent', e);
  }
}

export function getPendingDrawIntent(): PendingDrawIntent | null {
  try {
    const raw = localStorage.getItem(PENDING_DRAW_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingDrawIntent;
  } catch (e) {
    console.error('Failed to read pending draw intent', e);
    return null;
  }
}

export function clearPendingDrawIntent(): void {
  try {
    localStorage.removeItem(PENDING_DRAW_KEY);
  } catch (e) {
    console.error('Failed to clear pending draw intent', e);
  }
}

export function isPendingDrawIntentExpired(
  intent: PendingDrawIntent,
  now: number = Date.now(),
): boolean {
  return now - intent.queuedAt >= PENDING_DRAW_EXPIRY_MS;
}
