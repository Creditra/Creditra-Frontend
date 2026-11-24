import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calculator,
  Calendar,
  Check,
  Copy,
  DollarSign,
  Percent,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';

import { mockCreditLines } from '@/lib/draw-credit-mock-data';
import { getDrawPricingQuote } from '@/lib/draw-credit-pricing';
import { projectDraw } from '@/lib/draw-projection';
import { getAccruedInterest } from '@/lib/interest';
import {
  computePayoffProjection,
  computeDefaultMonthlyPayment,
  formatMonths,
  formatPayoffDate,
} from '@/utils/payoffProjection';
import { formatMoney } from '@/utils/amountValidation';
import { copyTextToClipboard } from '@/utils/clipboard';

import { AmountInput } from '@/components/AmountInput';
import { RepaymentPlanChart } from '@/components/RepaymentPlanChart';
import { AffordabilityCalc } from '@/components/AffordabilityCalc';

import type { CreditLine as CanonicalCreditLine } from '@/types/creditLine';
import { SIMULATOR_COPY, SIMULATOR_DISCLAIMERS } from '@/copy/simulator';

import './Simulator.css';

export type RepaymentCadence = 'monthly' | 'biweekly' | 'weekly';

export function Simulator() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL params
  const [selectedLineId, setSelectedLineId] = useState<string>(() => {
    const lineParam = searchParams.get('line') ?? searchParams.get('lineId');
    if (lineParam && mockCreditLines.some((l) => l.id === lineParam)) {
      return lineParam;
    }
    return mockCreditLines[0]?.id ?? 'cl-001';
  });

  const [drawAmount, setDrawAmount] = useState<number>(() => {
    const amtParam = searchParams.get('amount') ?? searchParams.get('drawAmount');
    if (amtParam !== null && amtParam !== '') {
      const parsed = Number(amtParam);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
    }
    return 5000;
  });

  const [cadence, setCadence] = useState<RepaymentCadence>(() => {
    const c = searchParams.get('cadence');
    if (c === 'weekly' || c === 'biweekly' || c === 'monthly') return c;
    return 'monthly';
  });

  const [paymentInput, setPaymentInput] = useState<string>(() => {
    const p = searchParams.get('payment') ?? searchParams.get('repaymentAmount');
    return p !== null && p !== '' ? p : '500';
  });

  const [aprOverrideInput, setAprOverrideInput] = useState<string>(() => {
    const a = searchParams.get('apr') ?? searchParams.get('aprOverride');
    return a !== null ? a : '';
  });

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [showAffordability, setShowAffordability] = useState(false);

  // Sync state changes back to searchParams
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (selectedLineId) nextParams.set('line', selectedLineId);
    if (drawAmount >= 0) nextParams.set('amount', String(drawAmount));
    if (paymentInput !== '') nextParams.set('payment', paymentInput);
    if (cadence !== 'monthly') nextParams.set('cadence', cadence);
    if (aprOverrideInput !== '') nextParams.set('apr', aprOverrideInput);

    setSearchParams(nextParams, { replace: true });
  }, [selectedLineId, drawAmount, paymentInput, cadence, aprOverrideInput, setSearchParams]);

  // Resolve selected credit line
  const selectedLine = useMemo(() => {
    return (
      mockCreditLines.find((candidate) => candidate.id === selectedLineId) ??
      mockCreditLines[0]
    );
  }, [selectedLineId]);

  // Compute fee quote & pricing from underlying library
  const quote = useMemo(() => {
    return getDrawPricingQuote(selectedLine, drawAmount);
  }, [selectedLine, drawAmount]);

  // Compute projection from underlying library
  const projection = useMemo(() => {
    return projectDraw(selectedLine, drawAmount, quote);
  }, [selectedLine, drawAmount, quote]);

  // APR resolution: optional override or quoted APR
  const hasAprOverride =
    aprOverrideInput.trim() !== '' && !Number.isNaN(Number(aprOverrideInput));
  const parsedAprOverride = hasAprOverride ? Number(aprOverrideInput) : null;
  const isAprNegative = hasAprOverride && parsedAprOverride! < 0;
  const effectiveApr =
    hasAprOverride && parsedAprOverride! >= 0 ? parsedAprOverride! : quote.apr;

  // Amount validations
  const isDrawExceedingLimit =
    drawAmount > selectedLine.available || projection.exceedsLimit;

  // Repayment calculations
  const paymentNum = Number(paymentInput);
  const hasValidPaymentNum =
    paymentInput.trim() !== '' && Number.isFinite(paymentNum) && paymentNum > 0;

  const monthlyEquivalentPayment = useMemo(() => {
    if (!hasValidPaymentNum) return 0;
    if (cadence === 'weekly') return (paymentNum * 52) / 12;
    if (cadence === 'biweekly') return (paymentNum * 26) / 12;
    return paymentNum;
  }, [paymentNum, cadence, hasValidPaymentNum]);

  // Principal to repay is draw amount plus one-time fee
  const principalToRepay = drawAmount > 0 ? drawAmount + quote.fee : 0;

  // Estimated monthly interest: matches quote directly when not overridden
  const monthlyInterest = useMemo(() => {
    if (drawAmount <= 0 || effectiveApr <= 0) return 0;
    if (!hasAprOverride) return quote.estimatedMonthlyInterest;
    return Math.round(((drawAmount * (effectiveApr / 100)) / 12) * 100) / 100;
  }, [drawAmount, effectiveApr, hasAprOverride, quote.estimatedMonthlyInterest]);

  // Edge case: payment below interest
  const isPaymentBelowInterest =
    principalToRepay > 0 &&
    effectiveApr > 0 &&
    hasValidPaymentNum &&
    monthlyEquivalentPayment <= monthlyInterest;

  // Payoff projection calculation
  const payoff = useMemo(() => {
    if (principalToRepay <= 0 || !hasValidPaymentNum) {
      return {
        newMonths: 0,
        newTotalInterest: 0,
        isFullPayoff: true,
        isNeverPaidOff: false,
      };
    }

    return computePayoffProjection(
      principalToRepay,
      effectiveApr,
      monthlyEquivalentPayment,
      0,
      selectedLine.limit,
    );
  }, [principalToRepay, effectiveApr, monthlyEquivalentPayment, selectedLine.limit]);

  const totalInterest = payoff.newTotalInterest;
  const totalCost = principalToRepay + totalInterest;

  const isNeverPaidOff =
    isPaymentBelowInterest || payoff.isNeverPaidOff || payoff.newMonths >= 360;
  const payoffDateDisplay = isNeverPaidOff
    ? 'Never'
    : formatPayoffDate(payoff.newMonths, false);
  const payoffDurationDisplay = isNeverPaidOff
    ? '10+ years'
    : formatMonths(payoff.newMonths);

  // Accrued interest over time (ACT/365 convention)
  const accruedInterestHorizons = useMemo(() => {
    if (principalToRepay <= 0 || effectiveApr <= 0) {
      return [
        { label: '30 days (1 mo)', days: 30, amount: 0 },
        { label: '60 days (2 mo)', days: 60, amount: 0 },
        { label: '90 days (3 mo)', days: 90, amount: 0 },
        { label: '180 days (6 mo)', days: 180, amount: 0 },
        { label: '365 days (1 yr)', days: 365, amount: 0 },
      ];
    }

    const anchorDate = new Date('2026-06-01T00:00:00Z');
    return [30, 60, 90, 180, 365].map((days) => {
      const pastDate = new Date(
        anchorDate.getTime() - days * 24 * 60 * 60 * 1000,
      ).toISOString();
      const amount = getAccruedInterest(
        {
          id: `sim-${selectedLine.id}`,
          utilized: principalToRepay,
          apr: effectiveApr,
          transactions: [{ type: 'Interest', date: pastDate }],
        },
        anchorDate,
      );
      const label =
        days === 30
          ? '30 days (1 mo)'
          : days === 60
            ? '60 days (2 mo)'
            : days === 90
              ? '90 days (3 mo)'
              : days === 180
                ? '180 days (6 mo)'
                : '365 days (1 yr)';
      return { label, days, amount };
    });
  }, [principalToRepay, effectiveApr, selectedLine.id]);

  // Canonical line adaptation for RepaymentPlanChart
  const chartLine = useMemo<CanonicalCreditLine>(() => {
    const chartAvailable = drawAmount > 0 ? drawAmount : selectedLine.available;
    return {
      id: selectedLine.id,
      name: selectedLine.name,
      status: selectedLine.status,
      limit: selectedLine.limit,
      utilized: Math.max(0, selectedLine.limit - chartAvailable),
      apr: effectiveApr,
      riskScore: 720,
      openedAt: '2025-01-01',
      updatedAt: new Date().toISOString(),
      transactions: [],
      statusHistory: [],
    };
  }, [selectedLine, drawAmount, effectiveApr]);

  // Handler for copying shareable link
  const handleCopyLink = useCallback(async () => {
    try {
      await copyTextToClipboard(window.location.href);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 3000);
    } catch {
      // Fallback handled inside copyTextToClipboard
    }
  }, []);

  const handleDefaultPayment = useCallback(() => {
    const recommended = computeDefaultMonthlyPayment(
      principalToRepay,
      effectiveApr,
    );
    if (recommended > 0) {
      setPaymentInput(String(Math.ceil(recommended)));
    }
  }, [principalToRepay, effectiveApr]);

  return (
    <div className="simulator-page">
      {/* Page Header */}
      <div className="simulator-header">
        <div className="simulator-header__top">
          <div>
            <h1 className="simulator-title">{SIMULATOR_COPY.pageTitle}</h1>
            <p className="simulator-subtitle">{SIMULATOR_COPY.pageDescription}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="simulator-share-btn"
            aria-label="Copy shareable link with current simulator parameters"
          >
            {copiedShareLink ? (
              <>
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>{SIMULATOR_COPY.shareLinkText}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Controls on left/top, Results on right */}
      <div className="simulator-layout">
        {/* Controls Column */}
        <div className="simulator-controls">
          <section
            className="simulator-card"
            aria-labelledby="simulator-inputs-heading"
          >
            <h2 id="simulator-inputs-heading" className="simulator-card-title">
              <Calculator className="h-4 w-4 text-accent" aria-hidden="true" />
              Simulator Inputs
            </h2>

            {/* Line Selection */}
            <div className="simulator-form-group">
              <label
                htmlFor="simulator-line-select"
                className="simulator-label"
              >
                {SIMULATOR_COPY.lineSelectLabel}
              </label>
              <select
                id="simulator-line-select"
                aria-label="Select Credit Line"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="simulator-select"
              >
                {mockCreditLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name} ({line.status}) — Available: {formatMoney(line.available)} / Limit: {formatMoney(line.limit)}
                  </option>
                ))}
              </select>
            </div>

            {/* Draw Amount (AmountInput) */}
            <div className="simulator-form-group">
              <AmountInput
                key={`${selectedLine.id}-${drawAmount}`}
                creditLine={selectedLine}
                initialAmount={drawAmount}
                onAmountChange={(val) => setDrawAmount(val)}
                onNext={() => {}}
                onBack={() => {}}
              />
              {isDrawExceedingLimit && (
                <div
                  id="simulator-draw-exceeding-error"
                  role="alert"
                  aria-label="Draw amount exceeds available credit"
                  className="simulator-alert simulator-alert--danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Draw amount ({formatMoney(drawAmount)}) exceeds available credit of {formatMoney(selectedLine.available)}.
                  </span>
                </div>
              )}
            </div>

            {/* Repayment Cadence */}
            <div className="simulator-form-group">
              <label
                htmlFor="simulator-cadence-select"
                className="simulator-label"
              >
                {SIMULATOR_COPY.cadenceLabel}
              </label>
              <select
                id="simulator-cadence-select"
                aria-label="Repayment Cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as RepaymentCadence)}
                className="simulator-select"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            {/* Repayment Amount */}
            <div className="simulator-form-group">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="simulator-payment-input"
                  className="simulator-label"
                >
                  {SIMULATOR_COPY.repaymentAmountLabel} ($)
                </label>
                <button
                  type="button"
                  onClick={handleDefaultPayment}
                  className="text-xs text-accent hover:underline focus-visible:outline-accent"
                >
                  Use recommended
                </button>
              </div>
              <input
                id="simulator-payment-input"
                aria-label="Repayment Amount"
                type="number"
                min="1"
                step="any"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                aria-invalid={!hasValidPaymentNum || isPaymentBelowInterest}
                aria-describedby="simulator-payment-error simulator-payment-interest-warning"
                className={`simulator-input ${
                  !hasValidPaymentNum || isPaymentBelowInterest
                    ? 'simulator-input--error'
                    : ''
                }`}
              />

              {!hasValidPaymentNum && (
                <div
                  id="simulator-payment-error"
                  role="alert"
                  aria-label="Enter a valid repayment amount"
                  className="simulator-alert simulator-alert--danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Enter a valid repayment amount greater than $0.</span>
                </div>
              )}

              {isPaymentBelowInterest && (
                <div
                  id="simulator-payment-interest-warning"
                  role="alert"
                  aria-label="Payment below monthly interest"
                  className="simulator-alert simulator-alert--danger"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Repayment of {formatMoney(monthlyEquivalentPayment)}/mo is less than or equal to monthly interest ({formatMoney(monthlyInterest)}/mo). Balance will never be paid off at this rate.
                  </span>
                </div>
              )}
            </div>

            {/* Optional APR Override */}
            <div className="simulator-form-group">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="simulator-apr-override-input"
                  className="simulator-label"
                >
                  {SIMULATOR_COPY.aprOverrideLabel}{' '}
                  <span className="text-muted font-normal">(Optional)</span>
                </label>
                {hasAprOverride && (
                  <button
                    type="button"
                    onClick={() => setAprOverrideInput('')}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    Reset to quoted
                  </button>
                )}
              </div>
              <input
                id="simulator-apr-override-input"
                aria-label="Optional APR Override"
                type="number"
                min="0"
                step="0.01"
                placeholder={`Quoted APR: ${quote.apr}%`}
                value={aprOverrideInput}
                onChange={(e) => setAprOverrideInput(e.target.value)}
                aria-invalid={isAprNegative}
                aria-describedby="simulator-apr-error simulator-apr-help"
                className={`simulator-input ${
                  isAprNegative ? 'simulator-input--error' : ''
                }`}
              />
              <p id="simulator-apr-help" className="simulator-help-text">
                {SIMULATOR_COPY.aprOverrideHelp}
              </p>

              {isAprNegative && (
                <div
                  id="simulator-apr-error"
                  role="alert"
                  aria-label="APR override cannot be negative"
                  className="simulator-alert simulator-alert--danger"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>APR override cannot be negative.</span>
                </div>
              )}
            </div>

            {/* Toggle Affordability Calculator */}
            <div className="mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAffordability(!showAffordability)}
                className="text-xs text-accent hover:underline flex items-center gap-1.5 font-medium"
                aria-expanded={showAffordability}
              >
                <span>{showAffordability ? 'Hide' : 'Calculate'} Affordable Repayment</span>
              </button>
              {showAffordability && (
                <div className="mt-3">
                  <AffordabilityCalc
                    onApply={(amt) => {
                      setPaymentInput(String(Math.round(amt)));
                      setCadence('monthly');
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Results Column */}
        <section aria-labelledby="simulator-results-heading" className="space-y-6">
          <h2 id="simulator-results-heading" className="sr-only">
            Simulation Results
          </h2>

          {/* Side by Side Metrics Cards */}
          <div className="simulator-side-by-side" role="region" aria-label="Simulation Results Summary">
            {/* Card 1: Fees Quote */}
            <section
              className="simulator-metric-card"
              aria-labelledby="metric-fees-heading"
            >
              <h3 id="metric-fees-heading" className="simulator-card-title">
                <DollarSign className="h-4 w-4 text-accent" aria-hidden="true" />
                {SIMULATOR_COPY.feeQuoteTitle}
              </h3>
              <p
                className="simulator-metric-value text-accent"
                data-testid="sim-fee-value"
              >
                {formatMoney(quote.fee)}
              </p>

              <div className="space-y-1.5 mt-2">
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Quoted APR</span>
                  <span className="simulator-metric-data" data-testid="sim-quoted-apr">
                    {quote.apr}%
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Base APR</span>
                  <span className="simulator-metric-data">
                    {quote.baseApr}% ({quote.riskBand})
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Projected Line Utilization</span>
                  <span className="simulator-metric-data" data-testid="sim-utilization-after">
                    {projection.newUtilizationPct}%
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Remaining Available</span>
                  <span className="simulator-metric-data">
                    {formatMoney(projection.remainingAvailable)}
                  </span>
                </div>
              </div>
            </section>

            {/* Card 2: Interest Accrual */}
            <section
              className="simulator-metric-card"
              aria-labelledby="metric-interest-heading"
            >
              <h3 id="metric-interest-heading" className="simulator-card-title">
                <Percent className="h-4 w-4 text-warning" aria-hidden="true" />
                {SIMULATOR_COPY.interestTitle}
              </h3>
              <p
                className="simulator-metric-value text-warning"
                data-testid="sim-monthly-interest-value"
              >
                {formatMoney(monthlyInterest)}
                <span className="text-xs font-normal text-muted ml-1">/ mo</span>
              </p>

              <div className="space-y-1.5 mt-2">
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Effective APR</span>
                  <span className="simulator-metric-data" data-testid="sim-effective-apr">
                    {effectiveApr}% {hasAprOverride && '(Override)'}
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Total Interest to Payoff</span>
                  <span className="simulator-metric-data" data-testid="sim-total-interest">
                    {formatMoney(totalInterest)}
                  </span>
                </div>
              </div>

              {/* Accrued Interest Horizons Table */}
              <div className="simulator-table-wrapper">
                <table
                  className="simulator-table"
                  aria-label="Accrued interest over time"
                >
                  <caption className="sr-only">
                    Estimated simple interest accrued at various horizons using ACT/365 convention.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Horizon</th>
                      <th scope="col" className="text-right">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accruedInterestHorizons.map((row) => (
                      <tr key={row.days}>
                        <th scope="row" className="font-normal text-muted">
                          {row.label}
                        </th>
                        <td className="text-right font-medium">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Card 3: Payoff & Total Cost */}
            <section
              className="simulator-metric-card"
              aria-labelledby="metric-payoff-heading"
            >
              <h3 id="metric-payoff-heading" className="simulator-card-title">
                <Calendar className="h-4 w-4 text-success" aria-hidden="true" />
                {SIMULATOR_COPY.payoffTitle}
              </h3>
              <p
                className="simulator-metric-value text-success"
                data-testid="sim-payoff-date-value"
              >
                {payoffDateDisplay}
              </p>

              <div className="space-y-1.5 mt-2">
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Payoff Timeline</span>
                  <span className="simulator-metric-data" data-testid="sim-payoff-duration">
                    {payoffDurationDisplay}
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Principal + Fee</span>
                  <span className="simulator-metric-data">
                    {formatMoney(principalToRepay)}
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Total Repayment Cost</span>
                  <span className="simulator-metric-data font-bold" data-testid="sim-total-cost">
                    {formatMoney(totalCost)}
                  </span>
                </div>
                <div className="simulator-metric-item">
                  <span className="simulator-metric-label">Net Cost of Draw</span>
                  <span className="simulator-metric-data text-accent">
                    {formatMoney(quote.fee + totalInterest)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Repayment Chart Section */}
          <div className="simulator-card">
            <h3 className="simulator-card-title">
              <TrendingDown className="h-4 w-4 text-accent" aria-hidden="true" />
              {SIMULATOR_COPY.chartTitle}
            </h3>
            <RepaymentPlanChart line={chartLine} />
          </div>

          {/* Disclaimers Aside */}
          <aside
            className="simulator-disclaimers"
            aria-labelledby="simulator-disclaimers-heading"
          >
            <h3 id="simulator-disclaimers-heading">
              {SIMULATOR_DISCLAIMERS.title}
            </h3>
            <p>{SIMULATOR_DISCLAIMERS.summary}</p>
            <ul>
              {SIMULATOR_DISCLAIMERS.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </aside>
        </section>
      </div>
    </div>
  );
}

export default Simulator;
