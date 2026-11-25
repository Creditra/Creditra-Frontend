import {
  NOTIFICATION_COMMAND_IDS,
  type Notification,
  type NotificationCategory,
  type NotificationType,
} from "../types/notification";

export type NotificationChannelStatus =
  | "connecting"
  | "open"
  | "retrying"
  | "off";

interface SseEventSource extends EventTarget {
  close(): void;
}

export type EventSourceConstructor = new (url: string) => SseEventSource;

export interface NotificationChannelBackoff {
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
  setTimeout?: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout?: (
    timer: ReturnType<typeof globalThis.setTimeout>,
  ) => void;
}

export interface CreateSseChannelOptions {
  url: string;
  onNotification: (notification: Notification) => void;
  onStatus: (status: NotificationChannelStatus) => void;
  EventSource?: EventSourceConstructor;
  backoff?: NotificationChannelBackoff;
}

const VALID_TYPES: readonly NotificationType[] = [
  "success",
  "error",
  "warning",
  "info",
  "danger",
];
const VALID_CATEGORIES: readonly NotificationCategory[] = [
  "transaction",
  "credit_line",
  "risk_score",
  "rate_change",
  "auction",
  "system",
];
const validCommandIds: ReadonlySet<string> = new Set(NOTIFICATION_COMMAND_IDS);

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== "object") return false;
  const notification = value as Record<string, unknown>;
  if (
    typeof notification.id !== "string" ||
    notification.id.length === 0 ||
    typeof notification.type !== "string" ||
    !VALID_TYPES.includes(notification.type as NotificationType) ||
    typeof notification.category !== "string" ||
    !VALID_CATEGORIES.includes(notification.category as NotificationCategory) ||
    typeof notification.title !== "string" ||
    notification.title.length === 0 ||
    typeof notification.message !== "string" ||
    typeof notification.timestamp !== "string" ||
    typeof notification.read !== "boolean"
  ) {
    return false;
  }

  const timestamp = new Date(notification.timestamp);
  if (
    Number.isNaN(timestamp.getTime()) ||
    timestamp.toISOString() !== notification.timestamp
  ) {
    return false;
  }

  if (notification.action === undefined) return true;
  if (!notification.action || typeof notification.action !== "object") {
    return false;
  }

  const action = notification.action as Record<string, unknown>;
  if (typeof action.label !== "string" || action.label.length === 0) {
    return false;
  }
  if (action.kind === "route") {
    return (
      typeof action.to === "string" &&
      action.to.startsWith("/") &&
      !action.to.includes("://")
    );
  }
  return (
    action.kind === "command" &&
    typeof action.id === "string" &&
    validCommandIds.has(action.id)
  );
}

export function createSseChannel({
  url,
  onNotification,
  onStatus,
  EventSource: EventSourceOverride,
  backoff = {},
}: CreateSseChannelOptions): { close: () => void } {
  const Source =
    EventSourceOverride ??
    (typeof globalThis.EventSource === "undefined"
      ? undefined
      : globalThis.EventSource);
  if (!url || !Source) {
    onStatus("off");
    return { close: () => undefined };
  }

  const initialDelayMs = Math.max(0, backoff.initialDelayMs ?? 1_000);
  const maxDelayMs = Math.max(initialDelayMs, backoff.maxDelayMs ?? 30_000);
  const jitterRatio = Math.max(0, Math.min(1, backoff.jitterRatio ?? 0.2));
  const random = backoff.random ?? Math.random;
  const scheduleTimeout = backoff.setTimeout ?? globalThis.setTimeout;
  const cancelTimeout = backoff.clearTimeout ?? globalThis.clearTimeout;

  let closed = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let source: SseEventSource | undefined;

  const setStatus = (status: NotificationChannelStatus) => {
    if (!closed || status === "off") onStatus(status);
  };

  const detachAndClose = (current: SseEventSource) => {
    current.removeEventListener("open", handleOpen);
    current.removeEventListener("message", handleMessage);
    current.removeEventListener("error", handleError);
    current.close();
  };

  const delayForAttempt = () => {
    const exponentialDelay = Math.min(
      maxDelayMs,
      initialDelayMs * 2 ** retryAttempt,
    );
    retryAttempt += 1;
    const jitter = 1 + (random() * 2 - 1) * jitterRatio;
    return Math.max(0, Math.min(maxDelayMs, exponentialDelay * jitter));
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer !== undefined) return;
    setStatus("retrying");
    retryTimer = scheduleTimeout(() => {
      retryTimer = undefined;
      connect();
    }, delayForAttempt());
  };

  const handleOpen = (event: Event) => {
    if (closed || event.currentTarget !== source) return;
    retryAttempt = 0;
    setStatus("open");
  };

  const handleMessage = (event: Event) => {
    if (closed || event.currentTarget !== source || !("data" in event)) return;
    let payload: unknown;
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (isNotification(payload)) onNotification(payload);
  };

  const handleError = (event: Event) => {
    const failedSource = source;
    if (closed || !failedSource || event.currentTarget !== failedSource) return;
    source = undefined;
    detachAndClose(failedSource);
    scheduleReconnect();
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    try {
      const current = new Source(url);
      source = current;
      current.addEventListener("open", handleOpen);
      current.addEventListener("message", handleMessage);
      current.addEventListener("error", handleError);
    } catch {
      scheduleReconnect();
    }
  };

  connect();

  return {
    close: () => {
      if (closed) return;
      closed = true;
      if (retryTimer !== undefined) {
        cancelTimeout(retryTimer);
        retryTimer = undefined;
      }
      if (source) {
        const current = source;
        source = undefined;
        detachAndClose(current);
      }
      onStatus("off");
    },
  };
}
