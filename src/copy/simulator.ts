/**
 * Disclaimers and explanatory copy for the /simulator page.
 */

export interface SimulatorDisclaimer {
  title: string;
  summary: string;
  items: string[];
}

export const SIMULATOR_DISCLAIMERS: SimulatorDisclaimer = {
  title: 'Simulation Disclaimers',
  summary:
    'This credit simulator provides illustrative estimates for educational purposes. Final pricing, fees, and approval terms are subject to protocol verification.',
  items: [
    'Figures shown are estimates based on standard rate models and current credit line parameters; they do not constitute a formal commitment or credit approval.',
    'APR is modeled based on projected utilization tiers and risk bands. Final APR is fixed at draw execution time in accordance with smart contract terms.',
    'Payoff projections assume scheduled, recurring repayments with no additional draws, fee modifications, or delinquency.',
    'When monthly payments are lower than accrued interest, principal does not amortize and the debt cannot be retired without increasing payment amounts.',
    'Day-count conventions (ACT/365) and daily interest accrual may cause minor variances depending on actual transaction posting dates.',
  ],
};

export const SIMULATOR_COPY = {
  pageTitle: 'Credit & Repayment Simulator',
  pageDescription:
    'Model draw pricing, interest accrual, and repayment schedules side by side.',
  lineSelectLabel: 'Select Credit Line',
  drawAmountLabel: 'Draw Amount',
  cadenceLabel: 'Repayment Cadence',
  repaymentAmountLabel: 'Repayment Amount',
  aprOverrideLabel: 'APR Override (%)',
  aprOverrideHelp: 'Optional: override quoted APR to test alternative interest scenarios.',
  feeQuoteTitle: 'Draw Fee & Pricing',
  interestTitle: 'Interest Accrual',
  payoffTitle: 'Payoff Projection & Total Cost',
  chartTitle: 'Projected Repayment Schedule',
  shareLinkText: 'Copy Shareable Link',
  linkCopiedText: 'Shareable link copied to clipboard!',
};
