import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getPaymentDueState } from '../lib/payment-due';
import type { CreditLine, Transaction } from '../types/creditLine';
import { nowMs as clockNowMs } from '../lib/clock';
import { COLOR, fmt, fmtDate } from '../utils/tokens';

export type DashboardTransaction = Transaction & {
  lineName: string;
  lineId: string;
};

export interface DashboardNotification {
  icon: string;
  content: ReactNode;
  type: 'info' | 'warning' | 'danger';
  time?: string;
}

export const TX_ICON: Record<string, string> = {
  Draw: '↗',
  Repay: '↙',
  Fee: '📋',
  Interest: '📈',
};

export const TX_COLOR: Record<string, string> = {
  Draw: COLOR.danger,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
};

export function relativeTime(iso: string): string {
  const diff = clockNowMs() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

export function getRecentDashboardActivity(
  creditLines: readonly CreditLine[],
): DashboardTransaction[] {
  const all: DashboardTransaction[] = [];
  creditLines.forEach((creditLine) => {
    creditLine.transactions.forEach((transaction) => {
      all.push({
        ...transaction,
        lineName: creditLine.name,
        lineId: creditLine.id,
      });
    });
  });
  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return all.slice(0, 5);
}

export function getDashboardNotifications(
  creditLines: readonly CreditLine[],
): DashboardNotification[] {
  const overdueNotes: DashboardNotification[] = [];
  const dueTodayNotes: DashboardNotification[] = [];
  const upcomingNotes: DashboardNotification[] = [];
  const otherNotes: DashboardNotification[] = [];

  creditLines.forEach((creditLine) => {
    if (creditLine.status === 'Active' || creditLine.status === 'Suspended') {
      const dueState = getPaymentDueState(creditLine);
      if (dueState.kind === 'overdue') {
        overdueNotes.push({
          icon: '🚨',
          content: (
            <>
              Payment of{' '}
              <strong className="tabular-nums">
                {fmt(creditLine.nextPaymentAmount ?? 0)}
              </strong>{' '}
              for {creditLine.name} is{' '}
              <span className="tabular-nums">{dueState.days}</span> day
              {dueState.days !== 1 ? 's' : ''} overdue.{' '}
              <Link to={`/repay?line=${creditLine.id}`}>Repay now</Link>
            </>
          ),
          type: 'danger',
        });
      } else if (dueState.kind === 'due_today') {
        dueTodayNotes.push({
          icon: '⚠️',
          content: (
            <>
              Payment of{' '}
              <strong className="tabular-nums">
                {fmt(creditLine.nextPaymentAmount ?? 0)}
              </strong>{' '}
              for {creditLine.name} is due today.{' '}
              <Link to={`/repay?line=${creditLine.id}`}>Repay now</Link>
            </>
          ),
          type: 'warning',
        });
      } else if (dueState.kind === 'upcoming') {
        upcomingNotes.push({
          icon: '🗓️',
          content: (
            <>
              Payment of{' '}
              <strong className="tabular-nums">
                {fmt(creditLine.nextPaymentAmount ?? 0)}
              </strong>{' '}
              due in <span className="tabular-nums">{dueState.days}</span> day
              {dueState.days !== 1 ? 's' : ''} for {creditLine.name}.
            </>
          ),
          type: 'info',
        });
      }
    }

    if (creditLine.status === 'Suspended') {
      otherNotes.push({
        icon: '⚠️',
        content: (
          <>
            <strong>{creditLine.name}</strong> has been suspended. Make a
            repayment to restore access.
          </>
        ),
        type: 'warning',
        time: creditLine.updatedAt,
      });
    }
    if (creditLine.status === 'Defaulted') {
      otherNotes.push({
        icon: '🚨',
        content: (
          <>
            <strong>{creditLine.name}</strong> is in default (90+ days overdue).
            Contact support immediately.
          </>
        ),
        type: 'danger',
        time: creditLine.updatedAt,
      });
    }
    if (creditLine.status === 'Active') {
      const utilization = creditLine.utilized / creditLine.limit;
      if (utilization >= 0.75) {
        otherNotes.push({
          icon: '📊',
          content: (
            <>
              <strong>{creditLine.name}</strong> utilization is at{' '}
              <span className="tabular-nums">
                {Math.round(utilization * 100)}
              </span>
              %. Consider a repayment.
            </>
          ),
          type: 'warning',
        });
      }
    }
  });

  return [...overdueNotes, ...dueTodayNotes, ...upcomingNotes, ...otherNotes];
}
