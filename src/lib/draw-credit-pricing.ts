import { CreditLine, DrawPricingRiskBand } from "@/types/draw-credit.types";

/** One labelled component of the APR, alongside the risk-band base rate. */
export interface DrawPricingAdjustment {
  kind: "utilization" | "term";
  label: string;
  points: number;
}

export interface DrawPricingQuote {
  apr: number;
  /** Risk-band base rate, before any adjustments. */
  baseApr: number;
  /** The utilisation and term adjustments that make up `apr`. */
  adjustments: DrawPricingAdjustment[];
  fee: number;
  estimatedMonthlyInterest: number;
  riskBand: DrawPricingRiskBand;
  termMonths: number;
}

/** The result of pricing a draw: the amount drawn plus the state it produces. */
export interface DrawProjection {
  /** Amount the user asked to draw, clamped to zero. */
  amount: number;
  /** Balance already drawn on the line before this draw. */
  utilized: number;
  /** One-time fee charged on the drawn amount. */
  fee: number;
  /** Balance drawn on the line once the draw and its fee land. */
  utilizedAfter: number;
  /** Utilisation percentage (0–100) the line reaches after the draw. */
  utilizationAfter: number;
}

/** A forward-looking hint that drawing above `aboveAmount` raises the APR. */
export interface DrawPricingTierHint {
  /** APR that applies once the draw amount exceeds `aboveAmount`. */
  apr: number;
  /** The largest whole-dollar draw amount still priced at the current APR. */
  aboveAmount: number;
}


const BASE_APR_BY_RISK_BAND: Record<DrawPricingRiskBand, number> = {
  Prime: 7.5,
  Standard: 9.5,
  Watch: 11.5,
};

const FEE_RATE = 0.01;

const UTILIZATION_TIERS = [
  { minUtilization: 80, points: 2, label: "High utilization adjustment" },
  { minUtilization: 50, points: 1.25, label: "Moderate utilization adjustment" },
  { minUtilization: 0, points: 0.5, label: "Low utilization adjustment" },
] as const;

/**
 * Utilisation thresholds at which the APR steps up. Priced against the
 * *projected* utilisation after the draw (see {@link projectDraw}), so a draw
 * that takes a line from 40% to 95% is priced as high utilisation.
 */
const UTILIZATION_THRESHOLDS = [50, 80] as const;

/** Single rounding point for every floating-point APR sum. */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getUtilizationAdjustment(utilization: number) {
  const tier = UTILIZATION_TIERS.find(
    (candidate) => utilization >= candidate.minUtilization,
  );
  return tier ?? UTILIZATION_TIERS[UTILIZATION_TIERS.length - 1];
}

function getTermAdjustment(termMonths: number) {
  if (termMonths > 24) {
    return { points: 2.5, label: "Long-term pricing adjustment" };
  }

  if (termMonths > 12) {
    return { points: 1.5, label: "Standard-term pricing adjustment" };
  }

  return { points: 0.5, label: "Short-term pricing adjustment" };
}

/**
 * The fee charged on a draw. Kept as the single source of truth for fee
 * arithmetic so the projected utilisation accounts for it.
 */
export function getDrawFee(amount: number): number {
  const safeAmount = Math.max(amount, 0);
  return safeAmount > 0 ? roundTo2(safeAmount * FEE_RATE) : 0;
}

/**
 * Projects the state a draw produces, including the one-time fee, so the
 * *post-draw* utilisation can be derived from a single place.
 */
export function projectDraw(creditLine: CreditLine, amount: number): DrawProjection {
  const safeAmount = Math.max(Number.isFinite(amount) ? amount : 0, 0);
  const utilized = Math.max(creditLine.limit - creditLine.available, 0);
  const fee = getDrawFee(safeAmount);
  const utilizedAfter = utilized + safeAmount + fee;
  const utilizationAfter = (utilizedAfter / creditLine.limit) * 100;

  return { amount: safeAmount, utilized, fee, utilizedAfter, utilizationAfter };
}

/**
 * Mock pricing model for the draw-credit wizard.
 *
 * These values are explanatory placeholders until the backend returns a signed
 * pricing quote. Both the preview and confirmation steps call this helper so
 * the APR and the breakdown that explains it stay in sync.
 *
 * Pricing is computed on the *post-draw* utilisation: `amount` and the one-time
 * fee both push the line's balance up, so a draw that crosses a tier is priced
 * at the higher tier.
 */
export function getDrawPricingQuote(
  creditLine: CreditLine,
  amount: number,
): DrawPricingQuote {
  const safeAmount = Math.max(amount, 0);
  const fee = getDrawFee(safeAmount);
  const projection = projectDraw(creditLine, amount);
  const baseApr = BASE_APR_BY_RISK_BAND[creditLine.riskBand];
  const utilizationAdjustment = getUtilizationAdjustment(
    projection.utilizationAfter,
  );
  const termAdjustment = getTermAdjustment(creditLine.termMonths);
  const adjustments: DrawPricingAdjustment[] = [
    {
      kind: "utilization",
      label: utilizationAdjustment.label,
      points: utilizationAdjustment.points,
    },
    { kind: "term", label: termAdjustment.label, points: termAdjustment.points },
  ];
  const apr = roundTo2(
    baseApr + adjustments.reduce((total, item) => total + item.points, 0),
  );
  const estimatedMonthlyInterest =
    projection.amount > 0
      ? roundTo2((projection.amount * apr) / 100 / 12)
      : 0;

  return {
    apr,
    baseApr,
    adjustments,
    fee: projection.fee,
    estimatedMonthlyInterest,
    riskBand: creditLine.riskBand,
    termMonths: creditLine.termMonths,
  };
}

/**
 * Smallest whole-dollar draw amount that pushes the projected utilisation to at
 * least `targetUtilization`, or `null` when the line's available balance cannot
 * reach it.
 */
function minAmountForUtilization(
  creditLine: CreditLine,
  targetUtilization: number,
): number | null {
  const available = Math.max(creditLine.available, 0);
  const utilized = Math.max(creditLine.limit - creditLine.available, 0);
  const required = (creditLine.limit * targetUtilization) / 100 - utilized;
  // `projectDraw` adds a 1% fee on the drawn amount, so the drawn amount only
  // has to cover `required / 1.01`; the loop below corrects for fee rounding.
  let amount = Math.max(Math.ceil(required / (1 + FEE_RATE)), 0);

  while (
    amount <= available &&
    projectDraw(creditLine, amount).utilizationAfter < targetUtilization
  ) {
    amount += 1;
  }

  return amount <= available ? amount : null;
}

/**
 * The next point at which the APR steps up for this line, or `null` when no
 * larger draw would raise it.
 *
 * Because the APR is monotonic in the draw amount, this is the first tier
 * threshold the line has not yet reached.
 */
export function getNextAprTier(
  creditLine: CreditLine,
  amount: number,
): DrawPricingTierHint | null {
  const safeAmount = Math.max(Number.isFinite(amount) ? amount : 0, 0);
  const currentApr = getDrawPricingQuote(creditLine, safeAmount).apr;

  for (const threshold of UTILIZATION_THRESHOLDS) {
    const reach = minAmountForUtilization(creditLine, threshold);

    if (reach === null || reach <= safeAmount) {
      continue;
    }

    const apr = getDrawPricingQuote(creditLine, reach).apr;

    if (apr > currentApr) {
      return { apr, aboveAmount: reach - 1 };
    }
  }

  return null;
}
