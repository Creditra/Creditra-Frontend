import type { CreditLine, CreditLineTransaction } from '@/types/creditLine';
import { fromBaseUnits, type Money } from '@/utils/money';

export interface CreditLineMoney extends Omit<CreditLine, 'limit' | 'utilized'> {
  limit: Money;
  utilized: Money;
  nextPaymentAmount?: Money;
}

export interface CreditLineTransactionMoney extends Omit<CreditLineTransaction, 'amount'> {
  amount: Money;
}

export interface CreditLineView {
  id: string;
  limit: Money;
  utilized: Money;
  nextPaymentAmount?: Money;
}

const USDC_DECIMALS = 7;
const USDC_ASSET = 'USDC';

function toBaseUnits(dollars: number, decimals: number): bigint {
  const scale = 10n ** BigInt(decimals);
  const scaled = Math.round(dollars * Number(scale));
  return BigInt(scaled);
}

function toMoney(dollars: number, asset: string, decimals: number): Money {
  return fromBaseUnits(toBaseUnits(dollars, decimals), decimals, asset);
}

export function toLegacyNumber(m: Money): number {
  const scale = 10n ** BigInt(m.decimals);
  return Number(m.units) / Number(scale);
}

export function mapCreditLineToView(line: CreditLine): CreditLineView {
  return {
    id: line.id,
    limit: toMoney(line.limit, USDC_ASSET, USDC_DECIMALS),
    utilized: toMoney(line.utilized, USDC_ASSET, USDC_DECIMALS),
    nextPaymentAmount:
      line.nextPaymentAmount != null
        ? toMoney(line.nextPaymentAmount, USDC_ASSET, USDC_DECIMALS)
        : undefined,
  };
}

export function mapTransactionToMoney(tx: CreditLineTransaction): CreditLineTransactionMoney {
  return {
    ...tx,
    amount: toMoney(tx.amount, USDC_ASSET, USDC_DECIMALS),
  };
}

export function mapCreditLinesToViews(lines: CreditLine[]): CreditLineView[] {
  return lines.map(mapCreditLineToView);
}

export function mapTransactionsToMoney(txs: CreditLineTransaction[]): CreditLineTransactionMoney[] {
  return txs.map(mapTransactionToMoney);
}

export const USDC_MONEY_DECIMALS = USDC_DECIMALS;
export const USDC_MONEY_ASSET = USDC_ASSET;
