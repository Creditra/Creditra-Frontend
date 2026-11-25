import { useId, useMemo } from 'react';
import { Info } from 'lucide-react';
import {
  buildCreditInvocationArgs,
  formatFeeXlm,
  isFeeEstimationConfigured,
} from '../services/fees';
import { useNetworkFee } from '../hooks/useNetworkFee';
import './NetworkFeeDisplay.css';

export interface NetworkFeeDisplayProps {
  method: 'draw' | 'repay';
  lineId: string;
  amount: number;
  label?: string;
  /** Force-disable estimation, e.g. in tests or offline previews. */
  enabled?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  testId?: string;
}

const FEE_HELP_TEXT =
  "Network fees cover Stellar's inclusion fee plus the Soroban resource fee for this transaction. The final amount can vary slightly with network conditions.";

/**
 * Renders a debounced network-fee estimate for a draw/repay invocation.
 *
 * Never blocks the surrounding flow: while loading it shows "Estimating…" and
 * on any failure it shows "Estimate unavailable" rather than an error.
 */
export function NetworkFeeDisplay({
  method,
  lineId,
  amount,
  label = 'Network fee',
  enabled,
  containerClassName = 'network-fee',
  labelClassName = 'network-fee__label',
  valueClassName = 'network-fee__value',
  testId,
}: NetworkFeeDisplayProps) {
  const helpId = useId();
  const args = useMemo(
    () => buildCreditInvocationArgs(lineId, amount),
    [lineId, amount],
  );
  const estimationEnabled = enabled ?? isFeeEstimationConfigured();
  const fee = useNetworkFee(method, args, { enabled: estimationEnabled });

  const text =
    fee.status === 'ready'
      ? formatFeeXlm(fee.estimate.totalStroops)
      : fee.status === 'loading'
        ? 'Estimating…'
        : 'Estimate unavailable';

  return (
    <span className={containerClassName}>
      <span className={labelClassName}>
        {label}
        <button
          type="button"
          className="network-fee__help"
          aria-label="What is the network fee?"
          aria-describedby={helpId}
          title={FEE_HELP_TEXT}
        >
          <Info size={12} aria-hidden="true" />
        </button>
      </span>
      <span
        className={valueClassName}
        aria-live="polite"
        data-status={fee.status}
        data-testid={testId}
      >
        {text}
      </span>
      <span id={helpId} className="sr-only">
        {FEE_HELP_TEXT}
      </span>
    </span>
  );
}
