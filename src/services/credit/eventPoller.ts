import { rpc, scValToNative } from '@stellar/stellar-sdk';
import type { CreditLineStatus } from '../../types/creditLine';
import { decodeLosslessAmount } from './decoder';

export type CreditEventKind = 'draw' | 'repay' | 'status';

export interface CreditDomainEvent {
  id: string;
  kind: CreditEventKind;
  borrower: string;
  ledger: number;
  txHash: string;
  amount?: number;
  status?: CreditLineStatus;
}

export interface CreditEventPollerOptions {
  server: Pick<rpc.Server, 'getEvents' | 'getLatestLedger'>;
  contractId: string;
  borrower: string;
  onEvents: (events: CreditDomainEvent[]) => void;
  intervalMs?: number;
  maxBackoffMs?: number;
}

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_MAX_BACKOFF_MS = 120_000;
const PAGE_LIMIT = 100;
const MAX_SEEN_IDS = 1_000;

export const CREDIT_EVENT_TOPIC = 'AAAADwAAAAZjcmVkaXQAAA==';

const DRAW_TOPICS = new Set(['drawn', 'drawn_v2']);
const REPAY_TOPICS = new Set(['repay']);
const STATUS_TOPICS: Record<string, CreditLineStatus> = {
  opened: 'Active',
  opened_v2: 'Active',
  suspend: 'Suspended',
  susp_v2: 'Suspended',
  closed: 'Closed',
  closed_v2: 'Closed',
  defaulted: 'Defaulted',
  reinstate: 'Active',
};
const KNOWN_STATUSES: readonly CreditLineStatus[] = [
  'Active',
  'Suspended',
  'Defaulted',
  'Closed',
  'Frozen',
];

function readStatus(raw: unknown): CreditLineStatus | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return KNOWN_STATUSES.find((status) => status === value);
}

export function mapCreditEvent(event: rpc.Api.EventResponse): CreditDomainEvent | null {
  try {
    if (event.topic.length < 2 || scValToNative(event.topic[0]) !== 'credit') return null;
    const name = String(scValToNative(event.topic[1]));
    const payload = scValToNative(event.value) as Record<string, unknown> | null;
    if (!payload || typeof payload.borrower !== 'string') return null;

    const base = {
      id: event.id,
      borrower: payload.borrower,
      ledger: event.ledger,
      txHash: event.txHash,
    };

    if (DRAW_TOPICS.has(name)) {
      return { ...base, kind: 'draw', amount: decodeLosslessAmount(payload.amount) };
    }
    if (REPAY_TOPICS.has(name)) {
      return { ...base, kind: 'repay', amount: decodeLosslessAmount(payload.amount) };
    }
    if (name in STATUS_TOPICS) {
      return {
        ...base,
        kind: 'status',
        status: readStatus(payload.target_status ?? payload.status) ?? STATUS_TOPICS[name],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function startCreditEventPoller({
  server,
  contractId,
  borrower,
  onEvents,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
}: CreditEventPollerOptions): () => void {
  const filters: rpc.Api.EventFilter[] = [
    { type: 'contract', contractIds: [contractId], topics: [[CREDIT_EVENT_TOPIC, '*']] },
  ];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let polling = false;
  let stopped = false;

  const isHidden = () => document.visibilityState === 'hidden';
  const nextDelay = () =>
    failures === 0 ? intervalMs : Math.min(intervalMs * 2 ** failures, maxBackoffMs);

  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const schedule = (delayMs: number) => {
    clearTimer();
    if (stopped || isHidden()) return;
    timer = setTimeout(() => void poll(), delayMs);
  };

  const fetchPage = async () => {
    if (cursor) return server.getEvents({ filters, cursor, limit: PAGE_LIMIT });
    const { sequence } = await server.getLatestLedger();
    return server.getEvents({ filters, startLedger: sequence, limit: PAGE_LIMIT });
  };

  const remember = (id: string) => {
    seen.add(id);
    if (seen.size > MAX_SEEN_IDS) {
      seen.delete(seen.values().next().value as string);
    }
  };

  async function poll() {
    timer = undefined;
    if (stopped || polling || isHidden()) return;
    polling = true;
    let fresh: CreditDomainEvent[] = [];
    try {
      const page = await fetchPage();
      cursor = page.cursor || cursor;
      fresh = page.events
        .map(mapCreditEvent)
        .filter(
          (event): event is CreditDomainEvent =>
            event !== null && event.borrower === borrower && !seen.has(event.id),
        );
      fresh.forEach((event) => remember(event.id));
      failures = 0;
    } catch {
      failures += 1;
    } finally {
      polling = false;
    }
    if (stopped) return;
    if (fresh.length > 0) onEvents(fresh);
    schedule(nextDelay());
  }

  const handleVisibilityChange = () => {
    if (isHidden()) {
      clearTimer();
      return;
    }
    if (!timer && !polling) schedule(failures === 0 ? 0 : nextDelay());
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  void poll();

  return () => {
    stopped = true;
    clearTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
