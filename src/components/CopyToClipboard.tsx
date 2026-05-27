import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import './CopyToClipboard.css';

export const COPY_FEEDBACK_DURATION_MS = 2000;

interface CopyToClipboardProps {
  value: string;
  displayValue?: ReactNode;
  ariaLabel: string;
  copyLabel?: string;
  copiedLabel?: string;
  variant?: 'inline' | 'surface';
  className?: string;
  valueClassName?: string;
  buttonClassName?: string;
  stopPropagation?: boolean;
}

export function CopyToClipboard({
  value,
  displayValue,
  ariaLabel,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  variant = 'inline',
  className = '',
  valueClassName = '',
  buttonClassName = '',
  stopPropagation = false,
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }

    await copyTextToClipboard(value);

    setCopied(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, COPY_FEEDBACK_DURATION_MS);
  };

  const containerClassName = [
    'copy-affordance',
    variant === 'surface' ? 'copy-affordance--surface' : '',
    className,
  ].filter(Boolean).join(' ');

  const resolvedValueClassName = ['copy-affordance__value', valueClassName].filter(Boolean).join(' ');
  const resolvedButtonClassName = ['copy-affordance__button', buttonClassName].filter(Boolean).join(' ');
  const announcement = copied ? `${copiedLabel}: ${ariaLabel}` : '';

  return (
    <div className={containerClassName}>
      {displayValue ? <span className={resolvedValueClassName}>{displayValue}</span> : null}
      <button
        type="button"
        className={resolvedButtonClassName}
        aria-label={ariaLabel}
        data-copied={copied}
        onClick={handleCopy}
      >
        <span className="copy-affordance__button-label">{copied ? copiedLabel : copyLabel}</span>
        {copied ? (
          <Check className="copy-affordance__icon" aria-hidden="true" />
        ) : (
          <Copy className="copy-affordance__icon" aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
