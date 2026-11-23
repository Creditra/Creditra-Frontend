import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Total wallet session lifetime in ms (default 30 min).
 * After this window elapses the wallet extension silently disconnects.
 * Exposed so tests can pass a short override via `sessionTimeoutMs` prop.
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1_000;

/**
 * How far before session expiry (ms) to show the pre-disconnect warning banner.
 * Fixed at 60 s per the issue spec.
 */
export const SESSION_WARN_BEFORE_MS = 60_000;

export interface UseSessionTimeoutOptions {
  sessionTimeoutMs: number;
  onExpire: () => void;
}

export interface UseSessionTimeoutResult {
  sessionTimeoutWarning: boolean;
  startSessionTimers: () => void;
  clearSessionTimers: () => void;
  resetSessionWarning: () => void;
}

export function useSessionTimeout({
  sessionTimeoutMs,
  onExpire,
}: UseSessionTimeoutOptions): UseSessionTimeoutResult {
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);

  // Session-timeout refs: warn timer fires 60 s before expiry; expire timer fires at expiry.
  const sessionWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionExpireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  /** Cancel both session-timeout timers. Safe to call when none are active. */
  const clearSessionTimers = useCallback(() => {
    if (sessionWarnTimerRef.current !== null) {
      clearTimeout(sessionWarnTimerRef.current);
      sessionWarnTimerRef.current = null;
    }
    if (sessionExpireTimerRef.current !== null) {
      clearTimeout(sessionExpireTimerRef.current);
      sessionExpireTimerRef.current = null;
    }
  }, []);

  const resetSessionWarning = useCallback(() => {
    setSessionTimeoutWarning(false);
  }, []);

  /**
   * Start (or restart) the session-lifetime timers.
   * - At (sessionTimeoutMs - SESSION_WARN_BEFORE_MS): set sessionTimeoutWarning = true.
   * - At sessionTimeoutMs: expire the session via `onExpire`.
   */
  const startSessionTimers = useCallback(() => {
    clearSessionTimers();
    setSessionTimeoutWarning(false);

    const warnDelay = sessionTimeoutMs - SESSION_WARN_BEFORE_MS;
    if (warnDelay > 0) {
      sessionWarnTimerRef.current = setTimeout(() => {
        setSessionTimeoutWarning(true);
      }, warnDelay);
    } else {
      // Session shorter than warning window — warn immediately.
      setSessionTimeoutWarning(true);
    }

    sessionExpireTimerRef.current = setTimeout(() => {
      setSessionTimeoutWarning(false);
      onExpireRef.current();
    }, sessionTimeoutMs);
  }, [clearSessionTimers, sessionTimeoutMs]);

  useEffect(() => {
    return () => {
      clearSessionTimers();
    };
  }, [clearSessionTimers]);

  return {
    sessionTimeoutWarning,
    startSessionTimers,
    clearSessionTimers,
    resetSessionWarning,
  };
}
