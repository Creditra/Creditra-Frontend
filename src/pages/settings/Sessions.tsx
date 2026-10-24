/**
 * Sessions.tsx — Settings › Sessions
 *
 * Lists all active authenticated sessions for the current user and allows
 * them to revoke (sign out) any session except the one they are using right
 * now.  A "Revoke all other sessions" action is also provided for bulk
 * removal.
 *
 * @accessibility
 *   - Entire session list is a <ul> with role="list"; each row is a <li>.
 *   - ARIA-live "polite" region announces revoke outcomes to screen readers.
 *   - Current session row is labelled "(current session)" and its revoke
 *     button is absent to prevent accidental self-logout.
 *   - All interactive elements meet the 44×44 px touch target minimum.
 *   - Spinner has aria-label; busy state conveyed via aria-busy on buttons.
 *
 * @darkmode All colours reference var(--*) tokens from src/index.css.
 *
 * @mock
 *   Revoke operations simulate a 600 ms API call.  Replace the
 *   `simulateRevoke` helper with real fetch calls before shipping.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  MapPin,
  Clock,
  LogOut,
} from 'lucide-react';
import type { Session, RevokeState, RevokeStateMap } from '../../types/session';
import { MOCK_SESSIONS } from '../../data/mockData';
import './Sessions.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Picks a Lucide icon component for the given device type. */
function DeviceIcon({ type, className }: { type: Session['deviceType']; className?: string }) {
  const props = { size: 20, 'aria-hidden': true as const, className };
  switch (type) {
    case 'mobile':  return <Smartphone {...props} />;
    case 'tablet':  return <Tablet     {...props} />;
    case 'desktop': return <Monitor    {...props} />;
    default:        return <HelpCircle {...props} />;
  }
}

/**
 * Formats an ISO timestamp as a relative human-readable string.
 * Examples: "just now", "3 hours ago", "7 days ago".
 */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Simulates a successful 600 ms server-side revoke call. */
function simulateRevoke(_sessionId: string): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 600));
}

// ─── SessionRow ──────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: Session;
  revokeState: RevokeState;
  anyRevoking: boolean;
  onRevoke: (id: string) => void;
}

function SessionRow({ session, revokeState, anyRevoking, onRevoke }: SessionRowProps) {
  const { id, isCurrent, deviceLabel, deviceType, ipAddress, location, lastActiveAt, createdAt } = session;
  const isRevoking = revokeState === 'loading';
  const isRevoked  = revokeState === 'success';
  const hasError   = revokeState === 'error';

  const rowClass = [
    'session-row',
    isCurrent  ? 'session-row--current'  : '',
    isRevoking ? 'session-row--revoking' : '',
    isRevoked  ? 'session-row--revoked'  : '',
  ].filter(Boolean).join(' ');

  return (
    <li
      className={rowClass}
      aria-label={`${deviceLabel}${isCurrent ? ', current session' : ''}`}
    >
      <div className="session-row__icon" aria-hidden="true">
        <DeviceIcon type={deviceType} />
      </div>

      <div className="session-row__body">
        <div className="session-row__header">
          <span className="session-row__device">{deviceLabel}</span>
          {isCurrent && (
            <span className="session-row__current-badge" aria-label="This is your current session">
              Current
            </span>
          )}
          {isRevoked && (
            <span className="session-row__current-badge" aria-label="Session revoked" style={{ color: 'var(--muted)', background: 'rgba(139,148,158,0.15)' }}>
              Revoked
            </span>
          )}
        </div>

        <ul className="session-row__meta" aria-label="Session details">
          <li className="session-row__meta-item">
            <MapPin size={12} aria-hidden="true" />
            <span>{location} · {ipAddress}</span>
          </li>
          <li className="session-row__meta-item">
            <Clock size={12} aria-hidden="true" />
            <span>
              Active {relativeTime(lastActiveAt)}{' '}
              &mdash; signed in {relativeTime(createdAt)}
            </span>
          </li>
        </ul>

        {hasError && (
          <p className="sessions-page__status-message sessions-page__status-message--error" role="alert">
            Failed to revoke — please try again.
          </p>
        )}
      </div>

      {!isCurrent && !isRevoked && (
        <div className="session-row__actions">
          <button
            className="session-row__revoke-btn"
            onClick={() => onRevoke(id)}
            disabled={anyRevoking}
            aria-busy={isRevoking}
            aria-label={
              isRevoking
                ? `Revoking session on ${deviceLabel}…`
                : `Revoke session on ${deviceLabel}`
            }
          >
            {isRevoking ? (
              <>
                <span className="sessions-page__spinner" aria-label="Revoking…" aria-hidden="true" />
                <span>Revoking…</span>
              </>
            ) : (
              <>
                <LogOut size={14} aria-hidden="true" />
                <span>Revoke</span>
              </>
            )}
          </button>
        </div>
      )}
    </li>
  );
}

// ─── SessionsSettings (page) ─────────────────────────────────────────────────

/**
 * Settings › Sessions page.
 *
 * Fetches sessions on mount and provides per-session and bulk-revoke actions.
 */
export interface SessionsSettingsProps {
  /** Revoke a session; defaults to a successful simulated request. */
  revokeSession?: (sessionId: string) => Promise<void>;
}

export default function SessionsSettings({
  revokeSession = simulateRevoke,
}: SessionsSettingsProps = {}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [revokeStates, setRevokeStates] = useState<RevokeStateMap>({});
  const [globalStatus, setGlobalStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Simulate a 400 ms API fetch
    const timer = setTimeout(() => {
      if (!cancelled) {
        setSessions(MOCK_SESSIONS);
        setPageLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // ── Cleanup status timeout on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setSessionRevokeState = useCallback((id: string, state: RevokeState) => {
    setRevokeStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const flashGlobalStatus = useCallback((kind: 'success' | 'error', message: string) => {
    setGlobalStatus({ kind, message });
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => setGlobalStatus(null), 5000);
  }, []);

  const anyRevoking = Object.values(revokeStates).some((s) => s === 'loading') || isRevokingAll;

  // ── Per-session revoke ───────────────────────────────────────────────────────
  const handleRevoke = useCallback(async (sessionId: string) => {
    setSessionRevokeState(sessionId, 'loading');
    try {
      await revokeSession(sessionId);
      setSessionRevokeState(sessionId, 'success');
      flashGlobalStatus('success', 'Session revoked successfully.');
    } catch {
      setSessionRevokeState(sessionId, 'error');
      flashGlobalStatus('error', 'Failed to revoke session. Please try again.');
    }
  }, [revokeSession, setSessionRevokeState, flashGlobalStatus]);

  // ── Revoke all other sessions ────────────────────────────────────────────────
  const handleRevokeAll = useCallback(async () => {
    const otherIds = sessions
      .filter((s) => !s.isCurrent && revokeStates[s.id] !== 'success')
      .map((s) => s.id);

    if (otherIds.length === 0) return;

    setIsRevokingAll(true);

    const results = await Promise.allSettled(
      otherIds.map(async (id) => {
        setSessionRevokeState(id, 'loading');
        await revokeSession(id);
        return id;
      }),
    );

    results.forEach((result, index) => {
      const id = otherIds[index];
      setSessionRevokeState(id, result.status === 'fulfilled' ? 'success' : 'error');
    });

    const failCount = results.filter((r) => r.status === 'rejected').length;
    if (failCount === 0) {
      flashGlobalStatus('success', `All other sessions (${otherIds.length}) revoked.`);
    } else {
      flashGlobalStatus(
        'error',
        `${failCount} of ${otherIds.length} sessions could not be revoked. Please try again.`,
      );
    }

    setIsRevokingAll(false);
  }, [revokeSession, sessions, revokeStates, setSessionRevokeState, flashGlobalStatus]);

  // ── Derived counts ───────────────────────────────────────────────────────────
  const revokeableCount = sessions.filter(
    (s) => !s.isCurrent && revokeStates[s.id] !== 'success',
  ).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="sessions-page" aria-labelledby="sessions-page-title">
      <h1 id="sessions-page-title" className="sessions-page__title">
        Active Sessions
      </h1>

      {/* ── ARIA-live status announcements ──────────────────────────────────── */}
      <div
        className="sessions-page__status-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {globalStatus && (
          <p
            role={globalStatus.kind === 'error' ? 'alert' : 'status'}
            className={`sessions-page__status-message sessions-page__status-message--${globalStatus.kind}`}
          >
            {globalStatus.kind === 'success' ? '✓ ' : '⚠ '}
            {globalStatus.message}
          </p>
        )}
      </div>

      {/* ── Active sessions list ─────────────────────────────────────────────── */}
      <section
        aria-labelledby="sessions-list-heading"
        className="sessions-page__section"
      >
        <h2 id="sessions-list-heading" className="sessions-page__section-title">
          Where you&apos;re signed in
        </h2>
        <p className="sessions-page__section-description">
          These are the devices currently authenticated with your account.
          Revoke any session you don&apos;t recognize to sign it out immediately.
        </p>

        {/* Bulk-revoke action row */}
        {!pageLoading && revokeableCount > 0 && (
          <div className="sessions-page__revoke-all-row">
            <button
              className="sessions-page__revoke-all-btn"
              onClick={handleRevokeAll}
              disabled={anyRevoking}
              aria-busy={isRevokingAll}
              aria-label={
                isRevokingAll
                  ? 'Revoking all other sessions…'
                  : `Revoke all other sessions (${revokeableCount})`
              }
            >
              {isRevokingAll ? (
                <>
                  <span className="sessions-page__spinner" aria-label="Revoking…" aria-hidden="true" />
                  <span>Revoking all…</span>
                </>
              ) : (
                <>
                  <LogOut size={16} aria-hidden="true" />
                  <span>Revoke all other sessions ({revokeableCount})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {pageLoading && (
          <ul
            className="sessions-page__skeleton-list"
            aria-label="Loading sessions…"
            aria-busy="true"
          >
            {[1, 2, 3].map((n) => (
              <li key={n} className="sessions-page__skeleton-row" aria-hidden="true" />
            ))}
          </ul>
        )}

        {/* Empty state */}
        {!pageLoading && sessions.length === 0 && (
          <div className="sessions-page__empty" role="status">
            <Monitor size={32} aria-hidden="true" />
            <span>No active sessions found.</span>
          </div>
        )}

        {/* Session rows */}
        {!pageLoading && sessions.length > 0 && (
          <ul className="sessions-page__list" aria-label="Active sessions">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                revokeState={revokeStates[session.id] ?? 'idle'}
                anyRevoking={anyRevoking}
                onRevoke={handleRevoke}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Security notice ──────────────────────────────────────────────────── */}
      <section
        aria-labelledby="sessions-security-heading"
        className="sessions-page__section"
      >
        <h2 id="sessions-security-heading" className="sessions-page__section-title">
          Security tips
        </h2>
        <p className="sessions-page__section-description">
          If you see a session you don&apos;t recognize, revoke it immediately and
          change your password. Sessions expire automatically after 30 days of
          inactivity. Your current session cannot be revoked from this screen —
          use <strong>Sign out</strong> to end it.
        </p>
      </section>
    </main>
  );
}
