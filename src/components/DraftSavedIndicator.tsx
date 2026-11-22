import { useEffect, useState } from 'react';
import { timeAgo } from '@/utils/dates';
import type { DraftSaveStatus } from '@/hooks/useDraftSaveStatus';

export interface DraftSavedIndicatorProps {
  status: DraftSaveStatus;
  savedAt: number | null;
  className?: string;
}

const JUST_NOW_THRESHOLD_MS = 60_000;
const REFRESH_INTERVAL_MS = 30_000;

/**
 * Quiet status indicator for debounced localStorage draft persistence.
 *
 * Shows "Saved just now" immediately after a save, transitions to a relative
 * timestamp via `timeAgo` as time passes, and displays "Couldn't save draft"
 * when persistence fails. Uses `role="status"` + `aria-live="polite"` so
 * screen readers hear one polite announcement per save burst.
 */
export function DraftSavedIndicator({
  status,
  savedAt,
  className = '',
}: DraftSavedIndicatorProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (status !== 'saved' || savedAt === null) return;
    setNow(Date.now());

    const id = setInterval(() => {
      setNow(Date.now());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [status, savedAt]);

  if (status === 'idle') {
    return null;
  }

  if (status === 'error') {
    return (
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="draft-saved-indicator"
        className={`text-xs text-error ${className}`.trim()}
      >
        Couldn&apos;t save draft
      </p>
    );
  }

  if (savedAt === null) {
    return null;
  }

  const elapsedMs = Math.max(0, now - savedAt);
  const label =
    elapsedMs < JUST_NOW_THRESHOLD_MS
      ? 'Saved just now'
      : `Saved ${timeAgo(new Date(savedAt), new Date(now))}`;

  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="draft-saved-indicator"
      className={`text-xs text-muted ${className}`.trim()}
    >
      {label}
    </p>
  );
}
