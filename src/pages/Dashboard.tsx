import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLineStatus, Transaction } from '../types/creditLine';
import {
  COLOR, UTIL_COLOR, STATUS_COLOR,
  fmt, fmtDate,
  getUtilizationLevel, utilizationPct,
} from '../utils/tokens';
import './Dashboard.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

const TX_ICON: Record<string, string> = {
  Draw: '↗',
  Repay: '↙',
  Fee: '📋',
  Interest: '📈',
};

const TX_COLOR: Record<string, string> = {
  Draw: COLOR.danger,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
};

// ─── Risk Score Gauge ─────────────────────────────────────────────────────────

function RiskGauge({ score, trend, lastUpdated }: {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}) {
  // SVG arc from 180° to 0° (semicircle)
  const radius = 55;
  const cx = 80;
  const cy = 75;
  const circumference = Math.PI * radius; // half circle
  const normalizedScore = Math.min(100, Math.max(0, score));
  const offset = circumference - (normalizedScore / 100) * circumference;

  const gaugeColor = score >= 70 ? COLOR.success : score >= 50 ? COLOR.warning : COLOR.danger;
  const trendArrow = trend === 'improving' ? '▲' : trend === 'declining' ? '▼' : '─';
  const trendColor = trend === 'improving' ? COLOR.success : trend === 'declining' ? COLOR.danger : COLOR.muted;

  return (
    <div className="risk-gauge-container">
      <svg className="risk-gauge-svg" viewBox="0 0 160 100">
        {/* Background arc */}
        <path
          className="risk-gauge-bg"
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        />
        {/* Filled arc */}
        <path
          className="risk-gauge-fill"
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          stroke={gaugeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        {/* Score text */}
        <text x={cx} y={cy - 12} className="risk-gauge-score">{normalizedScore}</text>
        <text x={cx} y={cy - 38} className="risk-gauge-label">Risk Score</text>
      </svg>

      <div className="risk-meta">
        <div className="risk-meta-item">
          <span className="rm-label">Trend</span>
          <span className="rm-value" style={{ color: trendColor }}>
            {trendArrow} {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </span>
        </div>
        <div className="risk-meta-item">
          <span className="rm-label">Last Updated</span>
          <span className="rm-value" style={{ color: COLOR.muted }}>{fmtDate(lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CreditLineStatus }) {
  const { bg, color } = STATUS_COLOR[status];
  return (
    <span className="status-badge" style={{ background: bg, color }}>
      <span className="dot" style={{ background: color }} />
      {status}
    </span>
  );
}

// ─── Dashboard Component ──────────────────────────────────────────────────────

export function Dashboard() {
  const { wallet, status } = useWallet();
  const [copied, setCopied] = useState(false);
  const creditLines = MOCK_CREDIT_LINES;

  // ─── Derived data ────────────────────────────────────────────────────────

  const activeLines = useMemo(
    () => creditLines.filter(cl => cl.status === 'Active' || cl.status === 'Suspended'),
    [creditLines]
  );

  const activeLinesOnly = useMemo(
    () => creditLines.filter(cl => cl.status === 'Active'),
    [creditLines]
  );

  const totalLimit = activeLinesOnly.reduce((s, cl) => s + cl.limit, 0);
  const totalUtilized = activeLinesOnly.reduce((s, cl) => s + cl.utilized, 0);
  const totalAvailable = totalLimit - totalUtilized;
  const overallPct = utilizationPct(totalUtilized, totalLimit || 1);
  const overallLevel = totalLimit > 0 ? getUtilizationLevel(totalUtilized, totalLimit) : 'low';

  // Weighted average risk score across active lines
  const avgRiskScore = activeLinesOnly.length > 0
    ? Math.round(activeLinesOnly.reduce((s, cl) => s + cl.riskScore, 0) / activeLinesOnly.length)
    : 0;

  // All transactions across all lines, sorted by date descending
  const recentActivity = useMemo(() => {
    const all: (Transaction & { lineName: string; lineId: string })[] = [];
    creditLines.forEach(cl => {
      cl.transactions.forEach(tx => {
        all.push({ ...tx, lineName: cl.name, lineId: cl.id });
      });
    });
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return all.slice(0, 5);
  }, [creditLines]);

  // Notifications
  const notifications = useMemo(() => {
    const notes: { icon: string; text: string; bg: string; time?: string }[] = [];

    creditLines.forEach(cl => {
      if (cl.status === 'Suspended') {
        notes.push({
          icon: '⚠️',
          text: `<strong>${cl.name}</strong> has been suspended. Make a repayment to restore access.`,
          bg: 'rgba(210,153,34,0.08)',
          time: cl.updatedAt,
        });
      }
      if (cl.status === 'Defaulted') {
        notes.push({
          icon: '🚨',
          text: `<strong>${cl.name}</strong> is in default (90+ days overdue). Contact support immediately.`,
          bg: 'rgba(248,81,73,0.08)',
          time: cl.updatedAt,
        });
      }
      if (cl.status === 'Active') {
        const util = cl.utilized / cl.limit;
        if (util >= 0.75) {
          notes.push({
            icon: '📊',
            text: `<strong>${cl.name}</strong> utilization is at ${Math.round(util * 100)}%. Consider a repayment.`,
            bg: 'rgba(210,153,34,0.08)',
          });
        }
        if (cl.nextPaymentDate) {
          const daysUntil = Math.ceil((new Date(cl.nextPaymentDate).getTime() - Date.now()) / 86400000);
          if (daysUntil > 0 && daysUntil <= 7) {
            notes.push({
              icon: '🗓️',
              text: `Payment of <strong>${fmt(cl.nextPaymentAmount ?? 0)}</strong> due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} for ${cl.name}.`,
              bg: 'rgba(88,166,255,0.08)',
            });
          }
        }
      }
    });

    return notes;
  }, [creditLines]);

  const hasLines = creditLines.length > 0;
  const hasUtilized = totalUtilized > 0;
  const isConnected = status === 'connected' && wallet;

  // Copy wallet address to clipboard
  const copyAddress = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncAddr = wallet?.publicKey
    ? `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`
    : '';

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!hasLines) {
    return (
      <>
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p className="subtitle">Your credit overview at a glance</p>
          </div>
          {isConnected && (
            <div className="wallet-info">
              <button className="wallet-address-chip" onClick={copyAddress}>
                {truncAddr}
                {copied && <span className="copy-feedback">✓ Copied</span>}
              </button>
              <span className={`network-badge ${wallet.network === 'TESTNET' ? 'testnet' : 'mainnet'}`}>
                <span className="dot" />
                {wallet.network === 'TESTNET' ? 'Testnet' : 'Mainnet'}
              </span>
            </div>
          )}
        </div>

        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h2>No credit lines yet</h2>
          <p>Start your credit journey by requesting a credit evaluation. We'll analyze your on-chain activity to determine your credit limit and terms.</p>
          <button className="empty-state-btn">
            🚀 Request Credit Evaluation
          </button>
        </div>
      </>
    );
  }

  // ─── Main Dashboard ──────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Your credit overview at a glance</p>
        </div>
        {isConnected && (
          <div className="wallet-info">
            <button className="wallet-address-chip" onClick={copyAddress}>
              {truncAddr}
              {copied && <span className="copy-feedback">✓ Copied</span>}
            </button>
            <span className={`network-badge ${wallet.network === 'TESTNET' ? 'testnet' : 'mainnet'}`}>
              <span className="dot" />
              {wallet.network === 'TESTNET' ? 'Testnet' : 'Mainnet'}
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="glow" style={{ background: COLOR.accent }} />
          <p className="label">Total Credit Limit</p>
          <p className="value" style={{ color: COLOR.accent }}>{fmt(totalLimit)}</p>
          <p className="sub">Across {activeLinesOnly.length} active line{activeLinesOnly.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="summary-card">
          <div className="glow" style={{ background: UTIL_COLOR[overallLevel] }} />
          <p className="label">Total Utilized</p>
          <p className="value" style={{ color: UTIL_COLOR[overallLevel] }}>{fmt(totalUtilized)}</p>
          <p className="sub">{overallPct}% of total limit</p>
        </div>
        <div className="summary-card">
          <div className="glow" style={{ background: COLOR.success }} />
          <p className="label">Available Credit</p>
          <p className="value" style={{ color: COLOR.success }}>{fmt(totalAvailable)}</p>
          <p className="sub">Ready to draw</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div>
          {/* Credit Summary */}
          <div className="card" style={{ animationDelay: '0.1s' }}>
            <h2><span className="icon">📊</span> Credit Summary</h2>

            <div className="util-bar-container">
              <div className="util-bar-header">
                <span style={{ color: COLOR.muted }}>Utilization</span>
                <span style={{ fontWeight: 600, color: UTIL_COLOR[overallLevel] }}>{overallPct}%</span>
              </div>
              <div className="util-bar-track">
                <div
                  className="util-bar-fill"
                  style={{ width: `${overallPct}%`, background: UTIL_COLOR[overallLevel] }}
                />
              </div>
            </div>

            <div className="credit-breakdown">
              <div className="credit-breakdown-item">
                <p className="cb-label">Total Limit</p>
                <p className="cb-value" style={{ color: COLOR.accent }}>{fmt(totalLimit)}</p>
              </div>
              <div className="credit-breakdown-item">
                <p className="cb-label">Utilized</p>
                <p className="cb-value" style={{ color: UTIL_COLOR[overallLevel] }}>{fmt(totalUtilized)}</p>
              </div>
              <div className="credit-breakdown-item">
                <p className="cb-label">Available</p>
                <p className="cb-value" style={{ color: COLOR.success }}>{fmt(totalAvailable)}</p>
              </div>
            </div>
          </div>

          {/* Risk Score */}
          <div className="card" style={{ animationDelay: '0.15s' }}>
            <h2><span className="icon">🛡️</span> Risk Score</h2>
            <RiskGauge
              score={avgRiskScore}
              trend="improving"
              lastUpdated={activeLinesOnly[0]?.updatedAt ?? new Date().toISOString()}
            />
          </div>

          {/* Active Credit Lines Preview */}
          <div className="card" style={{ animationDelay: '0.2s' }}>
            <h2>
              <span className="icon">💳</span> Active Credit Lines
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 400, color: COLOR.muted }}>
                {activeLines.length} line{activeLines.length !== 1 ? 's' : ''}
              </span>
            </h2>

            {activeLines.slice(0, 3).map(cl => {
              const pct = utilizationPct(cl.utilized, cl.limit);
              const level = getUtilizationLevel(cl.utilized, cl.limit);
              return (
                <div key={cl.id} className="cl-preview-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <p className="cl-preview-name">{cl.name}</p>
                      <StatusBadge status={cl.status} />
                    </div>
                    <p className="cl-preview-id">{cl.id}</p>
                  </div>
                  <div className="cl-preview-right">
                    <div className="cl-preview-amount">
                      {fmt(cl.utilized)} <span style={{ color: COLOR.muted, fontWeight: 400, fontSize: '0.75rem' }}>/ {fmt(cl.limit)}</span>
                    </div>
                    <div className="cl-preview-bar">
                      <div className="cl-preview-bar-fill" style={{ width: `${pct}%`, background: UTIL_COLOR[level] }} />
                    </div>
                  </div>
                </div>
              );
            })}

            <Link to="/credit-lines" className="view-all-link">
              View all credit lines →
            </Link>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Quick Actions */}
          <div className="card" style={{ animationDelay: '0.12s' }}>
            <h2><span className="icon">⚡</span> Quick Actions</h2>
            <div className="quick-actions-grid">
              {!hasLines && (
                <button
                  className="qa-btn"
                  style={{ borderColor: 'rgba(88,166,255,0.3)' }}
                >
                  <div className="qa-icon" style={{ background: 'rgba(88,166,255,0.12)', color: COLOR.accent }}>🆕</div>
                  <div>
                    <div className="qa-label" style={{ color: COLOR.accent }}>Open Credit Line</div>
                    <div className="qa-desc" style={{ color: COLOR.muted }}>Get started with your first line</div>
                  </div>
                  <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                </button>
              )}
              {hasLines && activeLinesOnly.length > 0 && (
                <button
                  className="qa-btn"
                  style={{ borderColor: 'rgba(88,166,255,0.3)' }}
                >
                  <div className="qa-icon" style={{ background: 'rgba(88,166,255,0.12)', color: COLOR.accent }}>↗</div>
                  <div>
                    <div className="qa-label" style={{ color: COLOR.accent }}>Draw Credit</div>
                    <div className="qa-desc" style={{ color: COLOR.muted }}>{fmt(totalAvailable)} available</div>
                  </div>
                  <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                </button>
              )}
              {hasUtilized && (
                <button
                  className="qa-btn"
                  style={{ borderColor: 'rgba(63,185,80,0.3)' }}
                >
                  <div className="qa-icon" style={{ background: 'rgba(63,185,80,0.12)', color: COLOR.success }}>↙</div>
                  <div>
                    <div className="qa-label" style={{ color: COLOR.success }}>Repay Credit</div>
                    <div className="qa-desc" style={{ color: COLOR.muted }}>{fmt(totalUtilized)} outstanding</div>
                  </div>
                  <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                </button>
              )}
              <Link
                to="/credit-lines"
                className="qa-btn"
                style={{ borderColor: 'transparent', textDecoration: 'none' }}
              >
                <div className="qa-icon" style={{ background: 'rgba(139,148,158,0.12)', color: COLOR.muted }}>📋</div>
                <div>
                  <div className="qa-label" style={{ color: COLOR.text }}>View Credit Lines</div>
                  <div className="qa-desc" style={{ color: COLOR.muted }}>Manage all your credit lines</div>
                </div>
                <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card" style={{ animationDelay: '0.18s' }}>
            <h2><span className="icon">📝</span> Recent Activity</h2>

            {recentActivity.length === 0 ? (
              <p style={{ color: COLOR.muted, fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>
                No transactions yet
              </p>
            ) : (
              recentActivity.map((tx, i) => (
                <div key={`${tx.id}-${i}`} className="activity-item">
                  <div
                    className="activity-icon"
                    style={{
                      background: `${TX_COLOR[tx.type]}15`,
                      color: TX_COLOR[tx.type],
                    }}
                  >
                    {TX_ICON[tx.type]}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{tx.note || tx.type}</div>
                    <div className="activity-sub">{tx.lineName} · {relativeTime(tx.date)}</div>
                  </div>
                  <div className="activity-amount" style={{ color: TX_COLOR[tx.type] }}>
                    {tx.type === 'Repay' ? '+' : '-'}{fmt(tx.amount)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="card" style={{ animationDelay: '0.22s' }}>
              <h2><span className="icon">🔔</span> Alerts</h2>

              {notifications.map((note, i) => (
                <div key={i} className="notification-item" style={{ background: note.bg }}>
                  <span className="notification-icon">{note.icon}</span>
                  <div>
                    <div
                      className="notification-text"
                      dangerouslySetInnerHTML={{ __html: note.text }}
                    />
                    {note.time && (
                      <div className="notification-time">{relativeTime(note.time)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
