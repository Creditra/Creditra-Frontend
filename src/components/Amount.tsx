import type { ReactNode } from 'react';
import { usePrivacyMode } from '../context/PrivacyContext';
import './Amount.css';

export type AmountValue = number | string | null | undefined;

export interface AmountProps<T extends AmountValue = AmountValue> {
  value: T;
  /** Custom formatter. Defaults to grouped digits with up to two decimals. */
  format?: (value: T) => ReactNode;
  /** Prefix rendered before the number (e.g. a currency symbol). */
  prefix?: string;
  /** Unit rendered after the number. Never masked. */
  symbol?: string;
  className?: string;
  /** Accessible description used while masked. */
  maskedLabel?: string;
}

const DEFAULT_MASKED_LABEL = 'Amount hidden for privacy';

function formatAmount(value: AmountValue): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Renders a monetary amount, or a mask when privacy mode is on.
 *
 * The real value is not rendered at all while masked — it is not merely hidden
 * with CSS — so it cannot leak through the accessibility tree, copy/paste or a
 * screenshot of the DOM.
 */
export function Amount<T extends AmountValue = AmountValue>({
  value,
  format,
  prefix,
  symbol,
  className,
  maskedLabel = DEFAULT_MASKED_LABEL,
}: AmountProps<T>) {
  const { privacyMode } = usePrivacyMode();
  const classes = ['amount', className].filter(Boolean).join(' ');

  if (privacyMode) {
    return (
      <span
        className={`${classes} amount--masked`}
        aria-label={maskedLabel}
        title={maskedLabel}
        data-privacy-masked="true"
      >
        <span aria-hidden="true">••••</span>
        {symbol ? ` ${symbol}` : null}
      </span>
    );
  }

  return (
    <span className={classes}>
      {prefix}
      {format ? format(value) : formatAmount(value)}
      {symbol ? ` ${symbol}` : null}
    </span>
  );
}
