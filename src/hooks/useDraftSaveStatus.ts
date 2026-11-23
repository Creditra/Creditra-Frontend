import { useCallback, useEffect, useRef, useState } from 'react';

export type DraftSaveStatus = 'idle' | 'saved' | 'error';

export interface UseDraftSaveStatusResult {
  status: DraftSaveStatus;
  savedAt: number | null;
  markSaved: () => void;
  markError: () => void;
  reset: () => void;
}

const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Tracks debounced localStorage draft save status so rapid typing yields
 * a single "saved" (or "error") state transition and polite screen-reader
 * announcement rather than one per keystroke.
 */
export function useDraftSaveStatus(
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): UseDraftSaveStatusResult {
  const [status, setStatus] = useState<DraftSaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markSaved = useCallback(() => {
    clearPendingTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStatus('saved');
      setSavedAt(Date.now());
    }, debounceMs);
  }, [clearPendingTimer, debounceMs]);

  const markError = useCallback(() => {
    clearPendingTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStatus('error');
      setSavedAt(null);
    }, debounceMs);
  }, [clearPendingTimer, debounceMs]);

  const reset = useCallback(() => {
    clearPendingTimer();
    setStatus('idle');
    setSavedAt(null);
  }, [clearPendingTimer]);

  useEffect(() => clearPendingTimer, [clearPendingTimer]);

  return {
    status,
    savedAt,
    markSaved,
    markError,
    reset,
  };
}
