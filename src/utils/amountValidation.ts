export type ValidationSeverity = 'info' | 'success' | 'warning' | 'danger';

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

export function getRepayAmountValidation(
  amountInput: string,
  totalDue: number,
  walletBalance: number,
): RepayAmountValidationResult {
  const amount = Number.parseFloat(amountInput) || 0;
  const hasEnteredAmount = amountInput.trim() !== '';
  const remainingDebt = Math.max(totalDue - amount, 0);
  const remainingWalletBalance = Math.max(walletBalance - amount, 0);
  const maxRepayAmount = Math.min(totalDue, walletBalance);
  const recommendedWalletReserve = getWalletReserveFloor(walletBalance);

  let feedback: ValidationFeedback = {
    severity: 'info',
    title: 'Visible constraints',
    message: `Repay between ${formatMoney(MIN_AMOUNT)} and ${formatMoney(maxRepayAmount)}. Keep enough wallet balance available for fees and short-term liquidity.`,
  };

  if (hasEnteredAmount && amount < MIN_AMOUNT) {
    feedback = {
      severity: 'danger',
      title: 'Minimum amount required',
      message: `Enter at least ${formatMoney(MIN_AMOUNT)} to continue.`,
    };
  } else if (hasEnteredAmount && amount > totalDue) {
    feedback = {
      severity: 'danger',
      title: 'Exceeds outstanding debt',
      message: `Reduce the repayment to ${formatMoney(totalDue)} or less.`,
    };
  } else if (hasEnteredAmount && amount > walletBalance) {
    feedback = {
      severity: 'danger',
      title: 'Exceeds wallet balance',
      message: `Reduce the repayment to ${formatMoney(walletBalance)} or less.`,
    };
  } else if (hasEnteredAmount && remainingWalletBalance < recommendedWalletReserve) {
    feedback = {
      severity: 'warning',
      title: 'Low wallet reserve',
      message: `This leaves ${formatMoney(remainingWalletBalance)} in your wallet, below the suggested reserve of ${formatMoney(recommendedWalletReserve)}.`,
    };
  } else if (hasEnteredAmount && remainingDebt === 0) {
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
    isValid: hasEnteredAmount && amount >= MIN_AMOUNT && amount <= totalDue && amount <= walletBalance,
    minAmount: MIN_AMOUNT,
    maxRepayAmount,
    remainingDebt,
    remainingWalletBalance,
    recommendedWalletReserve,
    feedback,
  };
}
