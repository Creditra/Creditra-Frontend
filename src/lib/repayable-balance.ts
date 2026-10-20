export type Money = bigint;

export interface RepayableBalanceAsset {
  code: string;
  issuer?: string;
}

export interface WalletAssetBalance {
  asset: string;
  balance: string;
  issuer?: string;
}

export type RepayableBalanceResult =
  | { amount: Money; status: 'ok' }
  | { amount: null; status: 'no_trustline' | 'loading' };

const STROOPS_PER_UNIT = 10_000_000n;
const STROOPS_PER_CENT = 100_000n;

export const SETTLEMENT_ASSET: RepayableBalanceAsset = {
  code: import.meta.env.VITE_SETTLEMENT_ASSET_CODE || 'USDC',
  issuer:
    import.meta.env.VITE_SETTLEMENT_ASSET_ISSUER ||
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

export function parseMoney(value: string): Money {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) {
    throw new Error(`Invalid Horizon balance: ${value}`);
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(7, '0'));
  return whole * STROOPS_PER_UNIT + fraction;
}

export function moneyToNumber(amount: Money): number {
  const cents = amount / STROOPS_PER_CENT;
  return Number(cents) / 100;
}

export function moneyCoversAmount(balance: Money, amount: number): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false;
  const amountCents = BigInt(Math.round(amount * 100));
  return amountCents * STROOPS_PER_CENT <= balance;
}

export function getRepayableBalance(
  balances: WalletAssetBalance[] | null,
  asset: RepayableBalanceAsset,
): RepayableBalanceResult {
  if (balances === null) {
    return { amount: null, status: 'loading' };
  }

  const balance = balances.find(
    (entry) =>
      entry.asset === asset.code &&
      (asset.issuer === undefined || entry.issuer === asset.issuer),
  );

  if (!balance) {
    return { amount: null, status: 'no_trustline' };
  }

  return { amount: parseMoney(balance.balance), status: 'ok' };
}
