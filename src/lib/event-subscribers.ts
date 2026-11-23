import type { AddToastOptions } from "../context/NotificationContext";
import { trackEvent } from "../utils/analytics";
import { on } from "./event-bus";

interface EventSubscriberDependencies {
  addToast: (options: AddToastOptions) => unknown;
  refetch: () => Promise<unknown>;
}

/**
 * Connects domain events to app-wide side effects. The returned disposer is
 * safe to call more than once, including React StrictMode effect cleanup.
 */
export function registerEventSubscribers({
  addToast,
  refetch,
}: EventSubscriberDependencies): () => void {
  const refreshCreditData = () => {
    void refetch().catch((error) => {
      console.error("[AppEventSubscribers] Credit data refetch failed:", error);
    });
  };

  const unsubscribers = [
    on("repay:success", (event) => {
      addToast({
        type: "success",
        category: "transaction",
        title: "Repayment successful",
        message: `Your repayment of $${event.amount.toFixed(2)} for ${event.creditLineName} was completed.`,
        saveToHistory: true,
      });
      void trackEvent({
        eventName: "repay_success",
        category: "usage",
        payload: event,
      });
      refreshCreditData();
    }),
    on("draw:success", (event) => {
      addToast({
        type: "success",
        category: "transaction",
        title: "Credit draw successful",
        message: `Your draw of $${event.amount.toFixed(2)} from ${event.creditLineName} was completed.`,
        saveToHistory: true,
      });
      void trackEvent({
        eventName: "draw_success",
        category: "usage",
        payload: event,
      });
      refreshCreditData();
    }),
    on("line:statusChanged", (event) => {
      addToast({
        type: "info",
        category: "credit_line",
        title: "Credit line status updated",
        message: event.previousStatus
          ? `${event.creditLineId}: ${event.previousStatus} → ${event.status}`
          : `${event.creditLineId} is now ${event.status}`,
        saveToHistory: true,
      });
      void trackEvent({
        eventName: "credit_line_status_changed",
        category: "usage",
        payload: event,
      });
      refreshCreditData();
    }),
  ];

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
