import type { CreditLineStatus } from "../types/creditLine";

export interface AppEvents {
  "repay:success": {
    transactionId: string;
    creditLineId: string;
    creditLineName: string;
    amount: number;
    remainingDebt: number;
    timestamp: string;
  };
  "draw:success": {
    transactionId: string;
    creditLineId: string;
    creditLineName: string;
    amount: number;
    timestamp: string;
  };
  "line:statusChanged": {
    creditLineId: string;
    previousStatus?: CreditLineStatus;
    status: CreditLineStatus;
  };
}

export type AppEventName = keyof AppEvents;
type EventListener = (payload: unknown) => void;

const listeners = new Map<AppEventName, Set<EventListener>>();

export function on<K extends AppEventName>(
  event: K,
  listener: (payload: AppEvents[K]) => void,
): () => void {
  let eventListeners = listeners.get(event);
  if (!eventListeners) {
    eventListeners = new Set<EventListener>();
    listeners.set(event, eventListeners);
  }

  const typedListener = listener as unknown as EventListener;
  eventListeners.add(typedListener);
  return () => off(event, listener);
}

export function off<K extends AppEventName>(
  event: K,
  listener: (payload: AppEvents[K]) => void,
): void {
  const eventListeners = listeners.get(event);
  if (!eventListeners) return;

  eventListeners.delete(listener as unknown as EventListener);
  if (eventListeners.size === 0) listeners.delete(event);
}

export function emit<K extends AppEventName>(
  event: K,
  payload: AppEvents[K],
): void {
  const eventListeners = listeners.get(event);
  if (!eventListeners) return;

  // Snapshot the set so subscriptions may safely change during dispatch.
  for (const listener of [...eventListeners]) {
    try {
      listener(payload);
    } catch (error) {
      // A faulty subscriber must never prevent the remaining listeners from
      // observing a domain event.
      console.error(`[AppEventBus] Listener for "${event}" failed:`, error);
    }
  }
}

export function once<K extends AppEventName>(
  event: K,
  listener: (payload: AppEvents[K]) => void,
): () => void {
  const wrapped = (payload: AppEvents[K]) => {
    off(event, wrapped);
    listener(payload);
  };
  return on(event, wrapped);
}
