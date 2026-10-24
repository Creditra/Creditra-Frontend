import { CreditLine } from "@/types/draw-credit.types";
import { DrawPricingQuote } from "./draw-credit-pricing";

export interface DrawProjection {
  fee: number;
  newBalance: number;
  newUtilizationPct: number;
  remainingAvailable: number;
  exceedsLimit: boolean;
}

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amountCents: number) => amountCents / 100;

export function projectDraw(
  line: CreditLine,
  amount: number,
  quote: DrawPricingQuote,
): DrawProjection {
  const amountCents = Math.max(toCents(amount), 0);
  const limitCents = Math.max(toCents(line.limit), 0);
  const utilizedCents = Math.max(limitCents - toCents(line.available), 0);
  const feeCents = Math.max(toCents(quote.fee), 0);
  const newBalanceCents = utilizedCents + amountCents + feeCents;
  const remainingAvailableCents = Math.max(limitCents - newBalanceCents, 0);

  return {
    fee: fromCents(feeCents),
    newBalance: fromCents(newBalanceCents),
    newUtilizationPct:
      limitCents === 0 ? 0 : Math.round((newBalanceCents / limitCents) * 100),
    remainingAvailable: fromCents(remainingAvailableCents),
    exceedsLimit: newBalanceCents > limitCents,
  };
}