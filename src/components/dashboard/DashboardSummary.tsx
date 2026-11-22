import { Link } from 'react-router-dom';
import ActivityFeed from '../ActivityFeed';
import { AttestationCard } from '../AttestationCard';
import { ContinuePrompt } from '../ContinuePrompt';
import { Skeleton } from '../Skeleton';
import { WhatChanged } from '../WhatChanged';
import { SyncIndicator } from '../SyncIndicator';
import { RiskGauge } from '../../pages/RiskGauge';
import { MOCK_ATTESTATIONS } from '../../data/mockData';
import { useDashboardDataContext } from '../../hooks/useDashboardData';
import { now as clockNow } from '../../lib/clock';
import { COLOR, UTIL_COLOR, fmt } from '../../utils/tokens';
import type { RefObject } from 'react';

export function DashboardSummary() {
  const {
    status,
    creditLines,
    activeLinesOnly,
    creditSummary,
    totalLimit,
    totalUtilized,
    totalAvailable,
    overallLevel,
    overallPct,
    hasLines,
  } = useDashboardDataContext();

  return (
    <>
      <div
        className="summary-cards"
        data-tour-target="summaryCards"
        aria-busy={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            {[0, 1, 2].map((card) => (
              <div className="summary-card skeleton-card" key={card}>
                <Skeleton
                  style={{
                    width: '60%',
                    height: 'var(--space-3)',
                    marginBottom: 'var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <Skeleton
                  style={{
                    width: '80%',
                    height: 'var(--space-8)',
                    marginBottom: 'var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <Skeleton
                  style={{
                    width: '40%',
                    height: 'var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="summary-card summary-card--accent">
              <div className="glow" style={{ background: COLOR.accent }} />
              <p className="label">
                Total Credit Limit
                <WhatChanged
                  metricId="total-limit"
                  currentValue={totalLimit}
                  format="currency"
                  label="Total Credit Limit"
                />
              </p>
              <p className="value num-tabular" style={{ color: COLOR.accent }}>
                {fmt(totalLimit)}
              </p>
              <p className="sub">
                Across {activeLinesOnly.length} active line
                {activeLinesOnly.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div
              className={`summary-card summary-card--util summary-card--util-${overallLevel}`}
            >
              <div
                className="glow"
                style={{ background: UTIL_COLOR[overallLevel] }}
              />
              <p className="label">
                Total Outstanding
                <WhatChanged
                  metricId="total-outstanding"
                  currentValue={totalUtilized}
                  format="currency"
                  label="Total Outstanding"
                />
              </p>
              <p
                className="value num-tabular"
                style={{ color: UTIL_COLOR[overallLevel] }}
              >
                {fmt(totalUtilized)}
              </p>
              <p className="sub">{overallPct}% of active drawable limit</p>
              {creditSummary.delinquentOutstanding > 0 && (
                <p className="sub">
                  incl. {fmt(creditSummary.delinquentOutstanding)} on
                  suspended/defaulted lines · <Link to="/repay">Repay</Link>
                </p>
              )}
            </div>
            <div className="summary-card summary-card--available">
              <div className="glow" style={{ background: COLOR.success }} />
              <p className="label">
                Available to draw
                <WhatChanged
                  metricId="available-credit"
                  currentValue={totalAvailable}
                  format="currency"
                  label="Available to draw"
                />
              </p>
              <p className="value num-tabular" style={{ color: COLOR.success }}>
                {fmt(totalAvailable)}
              </p>
              <p className="sub">From active lines only</p>
            </div>
          </>
        )}
      </div>
      {status === 'success' && <ActivityFeed />}
      {status === 'success' && hasLines && (
        <ContinuePrompt creditLines={creditLines} />
      )}
    </>
  );
}

export function DashboardSummaryMetrics({
  isExplainOpen,
  explainTriggerRef,
  openExplain,
}: {
  isExplainOpen: boolean;
  explainTriggerRef: RefObject<HTMLButtonElement | null>;
  openExplain: () => void;
}) {
  const {
    status,
    animDelay,
    creditSyncedAt,
    activitySyncedAt,
    handleCreditRefresh,
    overallPct,
    overallLevel,
    totalLimit,
    totalUtilized,
    totalAvailable,
    borrowerRiskScore,
    riskScoreLines,
  } = useDashboardDataContext();

  return (
    <>
      <div className="card" style={animDelay({ animationDelay: '0.1s' })}>
        <h2>
          <span className="icon">📊</span> Credit Summary
          {status === 'success' && creditSyncedAt && (
            <SyncIndicator
              lastSyncedAt={creditSyncedAt}
              onRefresh={handleCreditRefresh}
              className="sync-indicator--card-header"
            />
          )}
        </h2>
        <div className="util-bar-container">
          <div className="util-bar-header">
            <span style={{ color: COLOR.muted }}>Utilization</span>
            <span
              className="num-tabular"
              style={{
                fontWeight: 'var(--font-semibold)',
                color: UTIL_COLOR[overallLevel],
              }}
            >
              {overallPct}%
            </span>
          </div>
          <div className="util-bar-track">
            <div
              className={`util-bar-fill util-fill--${overallLevel}`}
              style={{
                width: `${overallPct}%`,
                background: UTIL_COLOR[overallLevel],
              }}
            />
          </div>
        </div>
        <div className="credit-breakdown">
          <div className="credit-breakdown-item">
            <p className="cb-label">Total Limit</p>
            <p className="cb-value num-tabular" style={{ color: COLOR.accent }}>
              {fmt(totalLimit)}
            </p>
          </div>
          <div className="credit-breakdown-item">
            <p className="cb-label">Utilized</p>
            <p
              className="cb-value num-tabular"
              style={{ color: UTIL_COLOR[overallLevel] }}
            >
              {fmt(totalUtilized)}
            </p>
          </div>
          <div className="credit-breakdown-item">
            <p className="cb-label">Available</p>
            <p
              className="cb-value num-tabular"
              style={{ color: COLOR.success }}
            >
              {fmt(totalAvailable)}
            </p>
          </div>
        </div>
      </div>

      <div
        className="card"
        data-tour-target="riskGauge"
        style={animDelay({ animationDelay: '0.15s' })}
        aria-busy={status === 'loading'}
      >
        <h2>
          <span className="icon">🛡️</span> Risk Score
          {status === 'success' && activitySyncedAt && (
            <button
              ref={explainTriggerRef}
              type="button"
              onClick={openExplain}
              aria-haspopup="dialog"
              aria-expanded={isExplainOpen}
              aria-label="Explain risk bands"
              className="risk-explainer-trigger focus-ring"
              data-testid="risk-explainer-trigger"
              style={{
                marginLeft: 'auto',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: '1px solid var(--border, #30363d)',
                color: 'var(--muted, #8b949e)',
                cursor: 'pointer',
                minHeight: '32px',
              }}
            >
              Explain
            </button>
          )}
        </h2>
        {status === 'loading' ? (
          <div className="risk-gauge-container">
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                height: '100px',
                width: '160px',
                marginBottom: '0.75rem',
              }}
            >
              <Skeleton
                style={{
                  width: '160px',
                  height: '80px',
                  borderRadius: '160px 160px 0 0',
                }}
              />
            </div>
            <div className="risk-meta" style={{ width: '100%' }}>
              <div
                className="risk-meta-item"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <Skeleton width={40} height={10} shape="rounded" />
                <Skeleton width={60} height={14} shape="rounded" />
              </div>
              <div
                className="risk-meta-item"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                <Skeleton width={60} height={10} shape="rounded" />
                <Skeleton width={50} height={14} shape="rounded" />
              </div>
            </div>
          </div>
        ) : (
          <RiskGauge
            score={borrowerRiskScore.score}
            caption={
              borrowerRiskScore.basis === 'limit_weighted'
                ? `Weighted across ${riskScoreLines.length} lines`
                : borrowerRiskScore.basis === 'borrower'
                  ? 'Borrower-level score'
                  : undefined
            }
            trend="improving"
            lastUpdated={
              riskScoreLines[0]?.updatedAt ?? clockNow().toISOString()
            }
          />
        )}
      </div>

      {status === 'success' && activitySyncedAt && (
        <AttestationCard attestations={MOCK_ATTESTATIONS} />
      )}
    </>
  );
}
