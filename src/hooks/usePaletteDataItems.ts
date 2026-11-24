import { useMemo } from 'react';
import {
  useCreditLines,
  useCreditTransactions,
  type CreditTransaction,
  type UseCreditLinesResult,
  type UseCreditTransactionsResult,
} from './useCreditLines';
import type { CreditLine } from '../types/creditLine';
import type { CommandItem } from '../components/CommandPalette';
import { DEFAULT_FILTERS, serializeTransactionFilters } from '../lib/transaction-filters';
import { fmt, fmtDate } from '../utils/tokens';

export const RECENT_TRANSACTIONS_LIMIT = 10;

export interface PaletteDataItems {
  creditLineItems: CommandItem[];
  transactionItems: CommandItem[];
}

function useSafeCreditLines(): Pick<UseCreditLinesResult, 'status' | 'lines'> {
  try {
    if (typeof useCreditLines !== 'function') {
      return { status: 'idle', lines: [] };
    }
    const result = useCreditLines();
    if (!result || result.status !== 'success' || !Array.isArray(result.lines)) {
      return { status: result?.status ?? 'idle', lines: [] };
    }
    return { status: result.status, lines: result.lines };
  } catch {
    return { status: 'error', lines: [] };
  }
}

function useSafeCreditTransactions(
  limit: number,
): Pick<UseCreditTransactionsResult, 'status' | 'transactions'> {
  try {
    if (typeof useCreditTransactions !== 'function') {
      return { status: 'idle', transactions: [] };
    }
    const result = useCreditTransactions({ limit });
    if (!result || result.status !== 'success' || !Array.isArray(result.transactions)) {
      return { status: result?.status ?? 'idle', transactions: [] };
    }
    return { status: result.status, transactions: result.transactions };
  } catch {
    return { status: 'error', transactions: [] };
  }
}

export function buildCreditLineItem(line: CreditLine): CommandItem {
  const params = new URLSearchParams({ line: line.id });
  return {
    id: `credit-line-${line.id}`,
    label: line.name,
    description: `${line.status} · ${fmt(line.utilized)} utilised`,
    icon: '💳',
    action: `/credit-lines?${params.toString()}`,
  };
}

export function buildTransactionItem(tx: CreditTransaction): CommandItem {
  const amountText = fmt(tx.amount);
  const label = `${tx.type} ${amountText}`;
  const dateText = fmtDate(tx.date);
  const descParts = [tx.lineName, dateText, tx.id];
  if (tx.note) {
    descParts.push(tx.note);
  }
  const searchQuery = serializeTransactionFilters({
    ...DEFAULT_FILTERS,
    q: tx.id,
  });

  return {
    id: `transaction-${tx.lineId}-${tx.id}`,
    label,
    description: descParts.join(' · '),
    icon: '📋',
    action: searchQuery ? `/transactions?${searchQuery}` : '/transactions',
  };
}

/**
 * Builds CommandPalette items for credit lines and the 10 most recent transactions.
 *
 * Safely handles loading, empty, error, or missing CreditDataProvider states
 * without throwing so CommandPalette remains resilient in isolated contexts.
 */
export function usePaletteDataItems(): PaletteDataItems {
  const { status: linesStatus, lines } = useSafeCreditLines();
  const { status: txStatus, transactions } = useSafeCreditTransactions(
    RECENT_TRANSACTIONS_LIMIT,
  );

  const creditLineItems = useMemo<CommandItem[]>(() => {
    if (linesStatus !== 'success' || lines.length === 0) return [];
    return lines.map(buildCreditLineItem);
  }, [linesStatus, lines]);

  const transactionItems = useMemo<CommandItem[]>(() => {
    if (txStatus !== 'success' || transactions.length === 0) return [];
    return transactions
      .slice(0, RECENT_TRANSACTIONS_LIMIT)
      .map(buildTransactionItem);
  }, [txStatus, transactions]);

  return { creditLineItems, transactionItems };
}
