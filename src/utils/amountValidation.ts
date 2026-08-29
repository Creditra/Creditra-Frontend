/**
 * UI-side amount validation for the draw and repay flows.
 *
 * The functions in this module produce *graded* feedback rather than a
 * binary valid/invalid. Each severity drives a different visual tone
 * (info / success / warning / danger) so the input feels conversational
 * during typing rather than hostile.
 *
 * These checks are deliberately optimistic guard rails — the Soroban
 * contract is the source of truth for what will actually be accepted,
 * and the backend will reject anything that slips through here. See
 * `docs/UX_RATIONALE.md` "Inline validation, not submit-time validation".
 */
export type ValidationSeverity = 'info' | 'success' | 'warning' | 'danger';

/**
 * Single piece of feedback paired with an `AmountInput` / `RepayModal`
 * tone band. `title` is the bold leading line; `message` is the body.
 */
interface ValidationFeedback {
  severity: ValidationSeverity;
  title: string;
  message: string;
}

export interface DrawAmountValidationResult {
  amount: number;
  hasEnteredAmount: boolean;
  isValid: boolean;
  minAmount: number;
  maxAmount: number;
  remainingCredit: number;
  recommendedReserve: number;
  feedback: ValidationFeedback;
}

export interface RepayAmountValidationResult {
  amount: number;
  hasEnteredAmount: boolean;
  isValid: boolean;
  minAmount: number;
  maxRepayAmount: number;
  remainingDebt: number;
  remainingWalletBalance: number;
  recommendedWalletReserve: number;
  feedback: ValidationFeedback;
}

const MIN_AMOUNT = 1;
const MIN_AMOUNT_CENTS = MIN_AMOUNT * 100;

/** Convert a dollar amount to whole cents (integer-exact). */
const toCents = (dollars: number): number => Math.round(dollars * 100);

/** Convert whole cents back to a dollar amount for display. */
const fromCents = (cents: number): number => cents / 100;

/**
 * Parse a user-entered monetary string into whole cents so that all
 * subsequent arithmetic/comparisons are integer-exact instead of relying on
 * floating-point dollars. Blank or unparseable input yields 0.
 */
const parseAmountToCents = (input: string): number => {
  if (input.trim() === '') return 0;
  const parsed = Number.parseFloat(input);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
};

/**
 * Threshold above which repayments require the user to type the exact amount
 * in a confirmation field before the "Confirm Repayment" button enables.
 *
 * Driven by the VITE_REPAY_CONFIRM_THRESHOLD environment variable (a plain
 * non-negative number). Falls back to 5 000 when the variable is absent or
 * cannot be parsed. Set the variable to "0" to disable the guard entirely.
 */
export const REPAY_CONFIRM_THRESHOLD = (() => {
  const raw = import.meta.env.VITE_REPAY_CONFIRM_THRESHOLD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
})();

/**
 * Returns `true` when `amount` meets or exceeds `REPAY_CONFIRM_THRESHOLD`,
 * indicating the confirm-by-typing guard should be shown in the review step.
 * When the threshold is `0` or negative, this always returns `false`,
 * effectively disabling the guard.
 */
export const requiresRepayConfirmation = (amount: number): boolean =>
  REPAY_CONFIRM_THRESHOLD > 0 && amount >= REPAY_CONFIRM_THRESHOLD;

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);

export const getCreditReserveFloor = (limit: number, available: number) =>
  Math.min(available, Math.max(5000, Math.round(limit * 0.1)));

export const getWalletReserveFloor = (walletBalance: number) =>
  Math.min(walletBalance, Math.max(100, Math.round(walletBalance * 0.1)));

/**
 * Validate a user-entered draw amount against a credit line and produce
 * UX-friendly feedback (success, info, warning, danger).
 *
 * The validation is purely UI-side and intentionally tolerant of partial
 * input: empty strings produce an informational message rather than an
 * error so the form does not feel hostile while the user is still typing.
 */
export function getDrawAmountValidation(
  amountInput: string,
  creditLine: { limit: number; available: number },
): DrawAmountValidationResult {
  const amount = Number.parseFloat(amountInput) || 0;
  const hasEnteredAmount = amountInput.trim() !== '';
  const remainingCredit = Math.max(creditLine.available - amount, 0);
  const recommendedReserve = getCreditReserveFloor(creditLine.limit, creditLine.available);

  let feedback: ValidationFeedback = {
    severity: 'info',
    title: 'Visible constraints',
    message: `Draw between ${formatMoney(MIN_AMOUNT)} and ${formatMoney(creditLine.available)}. Keep some available credit in reserve for fees or urgent liquidity.`,
  };

  if (hasEnteredAmount && amount < MIN_AMOUNT) {
    feedback = {
      severity: 'danger',
      title: 'Minimum amount required',
      message: `Enter at least ${formatMoney(MIN_AMOUNT)} to continue.`,
    };
  } else if (hasEnteredAmount && amount > creditLine.available) {
    feedback = {
      severity: 'danger',
      title: 'Exceeds available credit',
      message: `Reduce the draw to ${formatMoney(creditLine.available)} or less.`,
    };
  } else if (hasEnteredAmount && remainingCredit === 0) {
    feedback = {
      severity: 'warning',
      title: 'Uses full available credit',
      message: 'This draw would leave no available credit remaining.',
    };
  } else if (hasEnteredAmount && remainingCredit < recommendedReserve) {
    feedback = {
      severity: 'warning',
      title: 'Below recommended reserve',
      message: `This leaves ${formatMoney(remainingCredit)} available, below the suggested reserve of ${formatMoney(recommendedReserve)}.`,
    };
  } else if (hasEnteredAmount) {
    feedback = {
      severity: 'success',
      title: 'Draw amount looks good',
      message: `You will keep ${formatMoney(remainingCredit)} available after this draw.`,
    };
  }

  return {
    amount,
    hasEnteredAmount,
    isValid: hasEnteredAmount && amount >= MIN_AMOUNT && amount <= creditLine.available,
    minAmount: MIN_AMOUNT,
    maxAmount: creditLine.available,
    remainingCredit,
    recommendedReserve,
    feedback,
  };
}

/**
 * Validate a user-entered repayment amount against both the outstanding
 * debt and the connected wallet's available balance.
 *
 * Returns a structured result containing the parsed amount, derived
 * post-payment state, and UX-friendly feedback severity/title/message.
 */
export function getRepayAmountValidation(
  amountInput: string,
  totalDue: number,
  walletBalance: number,
): RepayAmountValidationResult {
  // Do all validation arithmetic/comparisons in whole cents so boundary
  // checks (full payoff, exceeds debt/wallet) are exact rather than subject
  // to floating-point drift. Only the values surfaced to the UI are converted
  // back to dollars.
  const amountCents = parseAmountToCents(amountInput);
  const hasEnteredAmount = amountInput.trim() !== '';
  const totalDueCents = toCents(totalDue);
  const walletBalanceCents = toCents(walletBalance);

  const remainingDebtCents = Math.max(totalDueCents - amountCents, 0);
  const remainingWalletBalanceCents = Math.max(walletBalanceCents - amountCents, 0);
  const maxRepayAmountCents = Math.min(totalDueCents, walletBalanceCents);
  const recommendedWalletReserve = getWalletReserveFloor(walletBalance);

  const amount = fromCents(amountCents);
  const remainingDebt = fromCents(remainingDebtCents);
  const remainingWalletBalance = fromCents(remainingWalletBalanceCents);
  const maxRepayAmount = fromCents(maxRepayAmountCents);
  const recommendedWalletReserveCents = toCents(recommendedWalletReserve);

  let feedback: ValidationFeedback = {
    severity: 'info',
    title: 'Visible constraints',
    message: `Repay between ${formatMoney(MIN_AMOUNT)} and ${formatMoney(maxRepayAmount)}. Keep enough wallet balance available for fees and short-term liquidity.`,
  };

  if (hasEnteredAmount && amountCents < MIN_AMOUNT_CENTS) {
    feedback = {
      severity: 'danger',
      title: 'Minimum amount required',
      message: `Enter at least ${formatMoney(MIN_AMOUNT)} to continue.`,
    };
  } else if (hasEnteredAmount && amountCents > totalDueCents) {
    feedback = {
      severity: 'danger',
      title: 'Exceeds outstanding debt',
      message: `Reduce the repayment to ${formatMoney(totalDue)} or less.`,
    };
  } else if (hasEnteredAmount && amountCents > walletBalanceCents) {
    feedback = {
      severity: 'danger',
      title: 'Exceeds wallet balance',
      message: `Reduce the repayment to ${formatMoney(walletBalance)} or less.`,
    };
  } else if (hasEnteredAmount && remainingWalletBalanceCents < recommendedWalletReserveCents) {
    feedback = {
      severity: 'warning',
      title: 'Low wallet reserve',
      message: `This leaves ${formatMoney(remainingWalletBalance)} in your wallet, below the suggested reserve of ${formatMoney(recommendedWalletReserve)}.`,
    };
  } else if (hasEnteredAmount && remainingDebtCents === 0) {
    feedback = {
      severity: 'success',
      title: 'Full repayment',
      message: 'This repayment clears the outstanding balance.',
    };
  } else if (hasEnteredAmount) {
    feedback = {
      severity: 'success',
      title: 'Repayment amount looks good',
      message: `You will have ${formatMoney(remainingDebt)} of debt remaining after this payment.`,
    };
  }

  return {
    amount,
    hasEnteredAmount,
    isValid:
      hasEnteredAmount &&
      amountCents >= MIN_AMOUNT_CENTS &&
      amountCents <= totalDueCents &&
      amountCents <= walletBalanceCents,
    minAmount: MIN_AMOUNT,
    maxRepayAmount,
    remainingDebt,
    remainingWalletBalance,
    recommendedWalletReserve,
    feedback,
  };
}
