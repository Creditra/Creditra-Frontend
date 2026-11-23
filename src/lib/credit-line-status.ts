import type {
  CreditLine,
  CreditLineStatus,
  StatusHistoryEntry,
} from '../types/creditLine';

export type DrawBlockedReason = 'suspended' | 'defaulted' | 'frozen' | 'closed';

interface CreditLineStatusRules {
  transitions: readonly CreditLineStatus[];
  canDraw: boolean;
  canRepay: boolean;
  drawBlockedReason: DrawBlockedReason | null;
  delinquent: boolean;
}

export const CREDIT_LINE_STATUS_RULES: Readonly<
  Record<CreditLineStatus, CreditLineStatusRules>
> = {
  Active: {
    transitions: ['Suspended', 'Defaulted', 'Closed', 'Frozen'],
    canDraw: true,
    canRepay: true,
    drawBlockedReason: null,
    delinquent: false,
  },
  Suspended: {
    transitions: ['Active', 'Defaulted', 'Closed', 'Frozen'],
    canDraw: false,
    canRepay: true,
    drawBlockedReason: 'suspended',
    delinquent: true,
  },
  Defaulted: {
    transitions: ['Active', 'Closed'],
    canDraw: false,
    canRepay: true,
    drawBlockedReason: 'defaulted',
    delinquent: true,
  },
  Closed: {
    transitions: [],
    canDraw: false,
    canRepay: false,
    drawBlockedReason: 'closed',
    delinquent: false,
  },
  Frozen: {
    transitions: ['Active', 'Suspended', 'Defaulted'],
    canDraw: false,
    canRepay: true,
    drawBlockedReason: 'frozen',
    delinquent: false,
  },
};

export interface CreditLineTransitionContext {
  statusHistory?: readonly StatusHistoryEntry[];
}

export interface CreditLineTransitionOptions {
  reason: string;
  now?: Date;
}

export interface CreditLineTransitionResult {
  status: CreditLineStatus;
  historyEntry: StatusHistoryEntry;
}

export class CreditLineTransitionError extends Error {
  readonly code = 'INVALID_CREDIT_LINE_TRANSITION';

  constructor(
    readonly from: CreditLineStatus,
    readonly to: CreditLineStatus,
  ) {
    super(`Credit line cannot transition from ${from} to ${to}`);
    this.name = 'CreditLineTransitionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function getRules(status: CreditLineStatus): CreditLineStatusRules {
  return CREDIT_LINE_STATUS_RULES[status] ?? CREDIT_LINE_STATUS_RULES.Active;
}

export function canDraw(status: CreditLineStatus): boolean {
  return getRules(status).canDraw;
}

export function canRepay(status: CreditLineStatus): boolean {
  return getRules(status).canRepay;
}

export function getDrawBlockedReason(
  status: CreditLineStatus,
): DrawBlockedReason | null {
  return getRules(status).drawBlockedReason;
}

export function isDelinquentStatus(status: CreditLineStatus): boolean {
  return getRules(status).delinquent;
}

export function getUnfrozenStatus(
  line: Pick<CreditLine, 'statusHistory'>,
): CreditLineStatus {
  let lastFrozenIndex = -1;
  for (let index = 0; index < line.statusHistory.length; index += 1) {
    if (line.statusHistory[index].status === 'Frozen') {
      lastFrozenIndex = index;
    }
  }

  return lastFrozenIndex > 0
    ? line.statusHistory[lastFrozenIndex - 1].status
    : 'Active';
}

export function canTransition(
  from: CreditLineStatus,
  to: CreditLineStatus,
  context: CreditLineTransitionContext = {},
): boolean {
  if (!getRules(from).transitions.includes(to)) {
    return false;
  }

  if (from === 'Frozen') {
    return (
      to === getUnfrozenStatus({ statusHistory: context.statusHistory ?? [] })
    );
  }

  return true;
}

export function applyTransition(
  line: Pick<CreditLine, 'status' | 'statusHistory'>,
  to: CreditLineStatus,
  { reason, now = new Date() }: CreditLineTransitionOptions,
): CreditLineTransitionResult {
  if (
    !canTransition(line.status, to, { statusHistory: line.statusHistory })
  ) {
    throw new CreditLineTransitionError(line.status, to);
  }

  return {
    status: to,
    historyEntry: {
      status: to,
      date: now.toISOString(),
      note: reason,
    },
  };
}
