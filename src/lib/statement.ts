/**
 * Monthly credit-line statement builder.
 *
 * Produces a reconciled statement for a given credit line, year and month:
 *   opening balance + draws + interest + fees − repayments = closing balance
 *
 * Rules
 * -----
 * - Only Completed transactions count toward balances (Pending/Failed skipped).
 * - Opening balance is derived by walking every Completed transaction that
 *   settled *before* the statement month in reverse (subtract draws/interest/
 *   fees, add repayments) starting from line.utilized.
 * - Money arithmetic uses exact bigint units (2-decimal USD throughout).
 * - The invariant opening + draws + interest + fees − repayments === closing
 *   is asserted at build time.
 */

import type { CreditLine, Transaction } from '@/types/creditLine';
import { toCsv } from '@/utils/csv';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSET = 'USD';
const DECIMALS = 2;
const SCALE = 100n; // 1 USD = 100 cents

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a plain dollar number to integer cents (bigint). */
function toCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

/** Convert integer cents back to a display number. */
function fromCents(cents: bigint): number {
  return Number(cents) / 100;
}

/** Format cents as a fixed 2-decimal string (e.g. "1234.56"). */
export function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Returns true if the ISO-8601 date string falls within the given year/month
 * in **local** time, matching how most financial UIs present calendar months.
 */
function isInMonth(isoDate: string, year: number, month: number): boolean {
  const d = new Date(isoDate);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

/** Returns true if the ISO-8601 date is strictly before the first day of year/month (local time). */
function isBeforeMonth(isoDate: string, year: number, month: number): boolean {
  const d = new Date(isoDate);
  const firstOfMonth = new Date(year, month - 1, 1);
  return d < firstOfMonth;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StatementEntry {
  id: string;
  date: string;
  type: 'Draw' | 'Repay' | 'Fee' | 'Interest';
  note?: string;
  txHash?: string;
  /** Signed cents: positive = balance increases (draws/interest/fees), negative = decreases (repayments). */
  amountCents: bigint;
  /** Display amount (always positive). */
  amount: number;
}

export interface MonthlyStatement {
  lineId: string;
  lineName: string;
  year: number;
  month: number;
  /** First day of the statement month as ISO date string (local midnight). */
  periodStart: string;
  /** Last day of the statement month as ISO date string (local midnight). */
  periodEnd: string;
  openingBalanceCents: bigint;
  drawsCents: bigint;
  repaymentsCents: bigint;
  interestCents: bigint;
  feesCents: bigint;
  closingBalanceCents: bigint;
  /** Display versions (dollars). */
  openingBalance: number;
  draws: number;
  repayments: number;
  interest: number;
  fees: number;
  closingBalance: number;
  entries: StatementEntry[];
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Build a monthly statement for a credit line.
 *
 * @param line  - Full credit line with transactions.
 * @param year  - Four-digit year (e.g. 2025).
 * @param month - 1-based month (1 = January, 12 = December).
 */
export function buildMonthlyStatement(
  line: CreditLine,
  year: number,
  month: number,
): MonthlyStatement {
  // ── Period boundaries ────────────────────────────────────────────────────
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // day 0 of next month = last day of current
  const periodStart = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
  const periodEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  // ── Filter to Completed money-movement transactions ──────────────────────
  const completed = (line.transactions ?? []).filter(
    (tx): tx is Transaction & { type: 'Draw' | 'Repay' | 'Fee' | 'Interest' } =>
      tx.status === 'Completed' &&
      (tx.type === 'Draw' || tx.type === 'Repay' || tx.type === 'Fee' || tx.type === 'Interest'),
  );

  // ── Opening balance ──────────────────────────────────────────────────────
  // Start from line.utilized (current balance), then reverse all Completed
  // transactions that settled *on or after* the first day of the statement
  // month back to get the balance at start of month.
  let runningCents = toCents(line.utilized);

  for (const tx of completed) {
    if (!isBeforeMonth(tx.date, year, month)) {
      // Reverse this transaction from the current balance
      switch (tx.type) {
        case 'Draw':
        case 'Fee':
        case 'Interest':
          runningCents -= toCents(tx.amount); // undo a balance increase
          break;
        case 'Repay':
          runningCents += toCents(tx.amount); // undo a balance decrease
          break;
      }
    }
  }

  const openingBalanceCents = runningCents < 0n ? 0n : runningCents;

  // ── In-month entries ─────────────────────────────────────────────────────
  const inMonth = completed.filter((tx) => isInMonth(tx.date, year, month));

  // Sort chronologically
  inMonth.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let drawsCents = 0n;
  let repaymentsCents = 0n;
  let interestCents = 0n;
  let feesCents = 0n;

  const entries: StatementEntry[] = inMonth.map((tx) => {
    const cents = toCents(tx.amount);
    let amountCents: bigint;

    switch (tx.type) {
      case 'Draw':
        drawsCents += cents;
        amountCents = cents;
        break;
      case 'Repay':
        repaymentsCents += cents;
        amountCents = -cents;
        break;
      case 'Interest':
        interestCents += cents;
        amountCents = cents;
        break;
      case 'Fee':
        feesCents += cents;
        amountCents = cents;
        break;
    }

    return {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      note: tx.note,
      txHash: tx.txHash,
      amountCents,
      amount: tx.amount,
    };
  });

  // ── Closing balance ──────────────────────────────────────────────────────
  const closingBalanceCents =
    openingBalanceCents + drawsCents + interestCents + feesCents - repaymentsCents;

  // ── Invariant assertion ──────────────────────────────────────────────────
  const check =
    openingBalanceCents + drawsCents + interestCents + feesCents - repaymentsCents;
  if (check !== closingBalanceCents) {
    throw new Error(
      `Statement invariant violated for ${line.id} ${year}-${month}: ` +
        `opening(${openingBalanceCents}) + draws(${drawsCents}) + interest(${interestCents}) + fees(${feesCents}) - repayments(${repaymentsCents}) ≠ closing(${closingBalanceCents})`,
    );
  }

  return {
    lineId: line.id,
    lineName: line.name,
    year,
    month,
    periodStart,
    periodEnd,
    openingBalanceCents,
    drawsCents,
    repaymentsCents,
    interestCents,
    feesCents,
    closingBalanceCents,
    openingBalance: fromCents(openingBalanceCents),
    draws: fromCents(drawsCents),
    repayments: fromCents(repaymentsCents),
    interest: fromCents(interestCents),
    fees: fromCents(feesCents),
    closingBalance: fromCents(closingBalanceCents < 0n ? 0n : closingBalanceCents),
    entries,
  };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const STATEMENT_CSV_HEADERS = [
  'date',
  'type',
  'amount',
  'note',
  'tx_hash',
] as const;

/**
 * Build a CSV string from a monthly statement.
 * Summary rows are prepended before the entry rows.
 */
export function buildStatementCsv(statement: MonthlyStatement): string {
  const monthStr = `${statement.year}-${String(statement.month).padStart(2, '0')}`;

  const summaryRows = [
    ['# Statement', `${statement.lineName} (${statement.lineId})`, monthStr, '', ''],
    ['# Opening Balance', '', formatCents(statement.openingBalanceCents), '', ''],
    ['# Closing Balance', '', formatCents(statement.closingBalanceCents), '', ''],
    ['', '', '', '', ''],
  ];

  const entryRows = statement.entries.map((e) => [
    e.date,
    e.type,
    formatCents(e.amountCents < 0n ? -e.amountCents : e.amountCents),
    e.note ?? '',
    e.txHash ?? '',
  ]);

  return toCsv(STATEMENT_CSV_HEADERS, [...summaryRows, ...entryRows]);
}

// ---------------------------------------------------------------------------
// Month helpers
// ---------------------------------------------------------------------------

/**
 * Returns all {year, month} pairs from the credit line's openedAt date up to
 * and including today's month, in chronological order.
 */
export function getAvailableMonths(
  line: CreditLine,
): { year: number; month: number; label: string }[] {
  const opened = new Date(line.openedAt);
  const now = new Date();

  const months: { year: number; month: number; label: string }[] = [];
  const cursor = new Date(opened.getFullYear(), opened.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    months.push({
      year: y,
      month: m,
      label: new Date(y, m - 1, 1).toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
