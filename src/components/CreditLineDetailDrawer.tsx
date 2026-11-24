import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Calendar, Activity, ArrowUpCircle, ArrowDownCircle, List } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import { StatusBadge } from './StatusBadge';
import ActivityTimeline, { type ActivityEntry } from './ActivityTimeline';
import { AprHistoryChart } from './AprHistoryChart';
import { HealthFactorChart, deriveHealthFactor } from './HealthFactorChart';
import {
  COLOR,
  fmt,
  fmtDate,
  utilizationPct,
  getUtilizationLevel,
  RISK_COLOR,
  UTIL_COLOR,
} from '../utils/tokens';
import { timeAgo } from '../utils/dates';
import { getExplorerBaseUrl } from '../utils/wallet';
import { getCreditNetworkConfig } from '../config/creditNetwork';
import type { CreditLine } from '../types/creditLine';
import './CreditLineDetailDrawer.css';

interface CreditLineDetailDrawerProps {
  line: CreditLine;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function CreditLineDetailDrawer({ line, onClose, triggerRef }: CreditLineDetailDrawerProps) {
  // Lock body scroll when drawer is open
  useBodyScrollLock({ isLocked: true });

  // Make background content inert to screen readers
  useInertBackdrop({ isInert: true, modalId: 'cl-details-drawer' });

  // Trap focus inside the drawer
  const drawerRef = useFocusTrap({
    isActive: true,
    triggerRef,
    onEscape: onClose,
  });

  const pct = utilizationPct(line.utilized, line.limit);
  const utilizationLevel = getUtilizationLevel(line.utilized, line.limit);
  const available = line.limit - line.utilized;
  const currentHealthFactor = deriveHealthFactor(line.limit, line.utilized);

  let explorerBase: string;
  try {
    const config = getCreditNetworkConfig();
    explorerBase = getExplorerBaseUrl(config?.network);
  } catch {
    explorerBase = getExplorerBaseUrl('PUBLIC');
  }

  const timelineEntries = useMemo<ActivityEntry[]>(() => {
    const txEntries: ActivityEntry[] = line.transactions.map((tx) => ({
      id: `tx-${tx.id}`,
      type: tx.type,
      timestamp: tx.date,
      description: tx.note
        ? `${tx.type} ${fmt(tx.amount)} — ${tx.note}`
        : `${tx.type} ${fmt(tx.amount)}`,
    }));

    const statusEntries: ActivityEntry[] = line.statusHistory.map((entry, idx) => ({
      id: `status-${idx}-${entry.date}`,
      type: 'StatusChange',
      timestamp: entry.date,
      description: entry.note
        ? `Status: ${entry.status} — ${entry.note}`
        : `Status changed to ${entry.status}`,
    }));

    return [...txEntries, ...statusEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [line.transactions, line.statusHistory]);

  // Reconstruct running balances for sparkline
  const runningBalances = useMemo(() => {
    // Sort transactions by date descending (newest first)
    const sortedTx = [...line.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let current = line.utilized;
    const history = [current];

    for (const tx of sortedTx) {
      if (tx.status === 'Failed') continue;
      let change = 0;
      if (tx.type === 'Draw') change = tx.amount;
      else if (tx.type === 'Repay') change = -tx.amount;
      else if (tx.type === 'Fee' || tx.type === 'Interest') change = tx.amount;

      current -= change;
      history.unshift(current);
    }

    // Ensure all values are non-negative
    return history.map((v) => Math.max(0, v));
  }, [line]);

  // Generate SVG path for the sparkline
  const sparklinePath = useMemo(() => {
    if (runningBalances.length < 2) return '';
    const maxVal = Math.max(...runningBalances, line.limit, 100);
    const minVal = 0;
    const range = maxVal - minVal;
    const width = 360;
    const height = 80;

    return runningBalances
      .map((val, idx) => {
        const x = (idx / (runningBalances.length - 1)) * width;
        const y = height - 10 - ((val - minVal) / range) * (height - 20);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [runningBalances, line.limit]);

  return (
    <div className="cl-drawer-overlay" onClick={onClose}>
      <div
        id="cl-details-drawer"
        ref={drawerRef}
        className="cl-drawer-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cl-drawer-title"
        aria-describedby="cl-drawer-desc"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Drawer Header */}
        <header className="cl-drawer-header">
          <div>
            <h2 id="cl-drawer-title" className="cl-drawer-title">
              {line.name}
            </h2>
            <p id="cl-drawer-desc" className="cl-drawer-id">
              {line.id}
            </p>
          </div>
          <div className="cl-drawer-header-actions">
            <StatusBadge status={line.status} />
            <button
              className="cl-drawer-close-btn"
              onClick={onClose}
              aria-label="Close details drawer"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Drawer Content */}
        <div className="cl-drawer-content">
          {/* Quick Action Links */}
          <nav className="cl-drawer-actions" aria-label="Credit line actions">
            <Link
              to={`/repay?line=${line.id}`}
              className="cl-drawer-action-link cl-drawer-action-primary"
              onClick={onClose}
            >
              <ArrowUpCircle size={15} aria-hidden="true" />
              Repay
            </Link>
            <Link
              to={`/draw-credit?line=${line.id}`}
              className="cl-drawer-action-link"
              onClick={onClose}
            >
              <ArrowDownCircle size={15} aria-hidden="true" />
              Draw Credit
            </Link>
            <Link
              to={`/transactions?line=${line.id}`}
              className="cl-drawer-action-link"
              onClick={onClose}
            >
              <List size={15} aria-hidden="true" />
              Transactions
            </Link>
          </nav>

          {/* Main metrics summary */}
          <section className="cl-drawer-section cl-metrics-grid">
            <div className="cl-drawer-metric">
              <span className="label">Credit Limit</span>
              <span className="value limit-val">{fmt(line.limit)}</span>
            </div>
            <div className="cl-drawer-metric">
              <span className="label">Utilized Balance</span>
              <span
                className="value utilized-val"
                style={{ color: UTIL_COLOR[utilizationLevel] }}
              >
                {fmt(line.utilized)}
              </span>
            </div>
            <div className="cl-drawer-metric">
              <span className="label">Available Limit</span>
              <span className="value available-val" style={{ color: COLOR.success }}>
                {fmt(available)}
              </span>
            </div>
            <div className="cl-drawer-metric">
              <span className="label">Interest Rate</span>
              <span className="value">{line.apr.toFixed(2)}% APR</span>
            </div>
          </section>

          {/* Utilization Progress Bar */}
          <section className="cl-drawer-section">
            <div className="cl-drawer-progress-header">
              <span>Utilization Level</span>
              <span style={{ color: UTIL_COLOR[utilizationLevel], fontWeight: 600 }}>
                {pct}% ({utilizationLevel})
              </span>
            </div>
            <div
              className="cl-drawer-progress-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Utilization percentage"
            >
              <div
                className="cl-drawer-progress-fill"
                style={{ width: `${pct}%`, background: UTIL_COLOR[utilizationLevel] }}
              />
            </div>
          </section>

          {/* Sparkline Visualization */}
          {runningBalances.length >= 2 && (
            <section className="cl-drawer-section">
              <h3 className="section-title">
                <Activity size={16} aria-hidden="true" /> Utilization Trend
              </h3>
              <div className="cl-drawer-sparkline-container">
                <svg className="cl-drawer-sparkline" viewBox="0 0 360 80" aria-label="Sparkline showing credit line balance history">
                  <defs>
                    <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {sparklinePath && (
                    <>
                      <path
                        d={sparklinePath}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={`${sparklinePath} L 360 80 L 0 80 Z`}
                        fill="url(#sparkline-gradient)"
                      />
                    </>
                  )}
                </svg>
                <div className="cl-drawer-sparkline-legend">
                  <span>Start</span>
                  <span>{fmt(line.utilized)} (Current)</span>
                </div>
              </div>
            </section>
          )}

          {/* Additional details */}
          <section className="cl-drawer-section additional-details">
            <h3 className="section-title">Facility Information</h3>
            <div className="details-list">
              <div className="detail-row">
                <span className="label">Risk Score</span>
                <span
                  className="value score-val"
                  style={{ color: RISK_COLOR(line.riskScore), fontWeight: 600 }}
                >
                  {line.riskScore}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Collateral Backing</span>
                <span className="value">{line.collateral || 'Unsecured / None'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Opened Date</span>
                <span className="value">{fmtDate(line.openedAt)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Last Activity</span>
                <span className="value">{timeAgo(line.updatedAt)}</span>
              </div>
              {line.nextPaymentDate && line.nextPaymentAmount && (
                <div className="detail-row payment-info">
                  <span className="label flex-label">
                    <Calendar size={14} aria-hidden="true" /> Next Payment Due
                  </span>
                  <span className="value">
                    {fmt(line.nextPaymentAmount)} on {fmtDate(line.nextPaymentDate)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* APR History Chart */}
          <section className="cl-drawer-section">
            <h3 className="section-title">APR History</h3>
            {line.aprHistory && line.aprHistory.length > 0 ? (
              <AprHistoryChart history={line.aprHistory} lineId={line.id} />
            ) : (
              <p className="cl-drawer-empty-state">
                No APR history available for this credit line.
              </p>
            )}
          </section>

          {/* Health Factor Chart */}
          <section className="cl-drawer-section">
            <h3 className="section-title">Health Factor</h3>
            {line.healthHistory && line.healthHistory.length > 0 ? (
              <HealthFactorChart
                data={line.healthHistory}
                current={currentHealthFactor}
                lineName={line.name}
              />
            ) : (
              <p className="cl-drawer-empty-state">
                No health factor history available for this credit line.
              </p>
            )}
          </section>

          {/* Activity Timeline */}
          <section className="cl-drawer-section">
            <h3 className="section-title">Activity Timeline</h3>
            <ActivityTimeline entries={timelineEntries} />
          </section>

          {/* Ledger / Transaction History */}
          <section className="cl-drawer-section transactions-history">
            <h3 className="section-title">Transaction History</h3>
            {line.transactions.length === 0 ? (
              <p className="no-transactions">No transactions recorded for this facility.</p>
            ) : (
              <div className="tx-list" role="feed" aria-label="Transaction history feed">
                {line.transactions.map((tx) => {
                  const isPositive = tx.type === 'Repay';
                  const amountSign = isPositive ? '+' : '-';
                  const amountColor = isPositive ? COLOR.success : COLOR.text;

                  return (
                    <div key={tx.id} className="tx-item" role="article">
                      <div className="tx-item-header">
                        <div className="tx-meta">
                          <span className="tx-type">{tx.type}</span>
                          <span className="tx-date" title={fmtDate(tx.date)}>
                            {timeAgo(tx.date)}
                          </span>
                        </div>
                        <span className="tx-amount" style={{ color: amountColor }}>
                          {amountSign}
                          {fmt(tx.amount)}
                        </span>
                      </div>
                      {tx.note && <p className="tx-note">{tx.note}</p>}
                      <div className="tx-footer">
                        <span className={`tx-status status-${tx.status.toLowerCase()}`}>
                          {tx.status}
                        </span>
                        {tx.txHash && (
                          <a
                            href={`${explorerBase}/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-explorer-link"
                            aria-label={`View transaction ${tx.id} on Stellar Explorer`}
                          >
                            Explorer <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
