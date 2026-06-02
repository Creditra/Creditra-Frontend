import type { CreditLineStatus } from '../types/creditLine';
import { STATUS_COLOR } from '../utils/tokens';
import './StatusBadge.css';

const STATUS_CUE: Record<CreditLineStatus, string> = {
  Active: 'A',
  Suspended: '!',
  Defaulted: 'X',
  Closed: 'C',
};

interface StatusBadgeProps {
  status: CreditLineStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { bg, color, border } = STATUS_COLOR[status];
  const classes = ['status-badge', className].filter(Boolean).join(' ');
  const cue = STATUS_CUE[status];

  return (
    <span
      className={classes}
      style={{ background: bg, color, borderColor: border }}
      aria-label={`Credit line status: ${status}`}
      title={`Status: ${status}`}
    >
      <span className="status-badge__cue" aria-hidden="true">
        {cue}
      </span>
      <span>{status}</span>
    </span>
  );
}
