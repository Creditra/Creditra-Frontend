import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, AttestationStatus } from '../types/attestation';
import { ATTESTATION_STATUS_COLOR, fmtDate } from '../utils/tokens';
import { LiveRegion } from './LiveRegion';
import './AttestationCard.css';

const EXPIRING_WINDOW_DAYS = 14;

const STATUS_CUE: Record<AttestationStatus, string> = {
  Verified: '✓',
  Expiring: '!',
  Missing: '✕',
};

const STATUS_COPY: Record<AttestationStatus, string> = {
  Verified: 'Verified',
  Expiring: 'Expiring soon',
  Missing: 'Missing',
};

function getAttestationStatus(attestation: Attestation): AttestationStatus {
  if (!attestation.lastVerifiedAt || !attestation.expiresAt) return 'Missing';
  const expiresAt = new Date(attestation.expiresAt).getTime();
  if (expiresAt <= Date.now()) return 'Missing';
  const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / 86400000);
  return daysUntilExpiry <= EXPIRING_WINDOW_DAYS ? 'Expiring' : 'Verified';
}

interface AttestationCardProps {
  attestations: Attestation[];
}

/**
 * Summarizes each attestation (identity bond, revenue proof, ...) with
 * its verification status, last-verified time, and — when action is
 * needed — a CTA that deep-links into the relevant `RequestEvaluation`
 * step for remediation.
 */
export function AttestationCard({ attestations }: AttestationCardProps) {
  const prevStatusesRef = useRef<Record<string, AttestationStatus>>({});
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  useEffect(() => {
    const newStatuses: Record<string, AttestationStatus> = {};
    const changed: string[] = [];

    attestations.forEach((att) => {
      const status = getAttestationStatus(att);
      newStatuses[att.id] = status;
      const prevStatus = prevStatusesRef.current[att.id];
      if (prevStatus && prevStatus !== status) {
        changed.push(`${att.label} status changed to ${STATUS_COPY[status]}`);
      }
    });

    if (changed.length > 0) {
      setLiveAnnouncement(changed.join('. '));
    }

    prevStatusesRef.current = newStatuses;
  }, [attestations]);

  return (
    <div className="card attestation-card">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
      <h2>
        <span className="icon">🪪</span> Attestations
      </h2>
      <ul className="attestation-list">
        {attestations.map((attestation) => {
          const status = getAttestationStatus(attestation);
          const { bg, color, border } = ATTESTATION_STATUS_COLOR[status];
          const needsRemediation = status !== 'Verified';

          return (
            <li key={attestation.id} className="attestation-row">
              <div className="attestation-row__main">
                <span className="attestation-row__label">{attestation.label}</span>
                <span
                  className="attestation-pill"
                  style={{ background: bg, color, borderColor: border }}
                  aria-label={`${attestation.label} attestation status: ${STATUS_COPY[status]}`}
                  title={STATUS_COPY[status]}
                >
                  <span className="attestation-pill__cue" aria-hidden="true">
                    {STATUS_CUE[status]}
                  </span>
                  <span>{STATUS_COPY[status]}</span>
                </span>
              </div>
              <div className="attestation-row__meta">
                <span className="attestation-row__verified">
                  {attestation.lastVerifiedAt ? `Last verified ${fmtDate(attestation.lastVerifiedAt)}` : 'Never verified'}
                </span>
                {needsRemediation && (
                  <Link to={`/open-credit?step=${attestation.remediationStep}`} className="attestation-row__cta">
                    {status === 'Missing' ? 'Submit attestation' : 'Renew attestation'} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
