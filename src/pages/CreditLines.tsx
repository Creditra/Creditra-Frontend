import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLineStatus, SortField, SortDirection } from '../types/creditLine';
import {
  COLOR, UTIL_COLOR, STATUS_COLOR,
  fmt, fmtDate, getUtilizationLevel, utilizationPct,
} from '../utils/tokens';
import './CreditLines.css';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CreditLineStatus }) {
  const { bg, color } = STATUS_COLOR[status];
  return (
    <span className="cl-status-badge" style={{ background: bg, color }}>
      <span className="dot" style={{ background: color }} />
      {status}
    </span>
  );
}

// ─── Credit Line Card ────────────────────────────────────────────────────────

function CreditLineCard({ line }: { line: typeof MOCK_CREDIT_LINES[0] }) {
  const pct = utilizationPct(line.utilized, line.limit);
  const level = getUtilizationLevel(line.utilized, line.limit);

  return (
    <div className="cl-card">
      <div className="cl-card-header">
        <div>
          <h3 className="cl-name">{line.name}</h3>
          <p className="cl-id">{line.id}</p>
        </div>
        <StatusBadge status={line.status} />
      </div>

      <div className="cl-card-body">
        <div className="cl-metrics">
          <div className="cl-metric">
            <span className="cl-metric-label">Limit</span>
            <span className="cl-metric-value" style={{ color: COLOR.accent }}>{fmt(line.limit)}</span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Utilized</span>
            <span className="cl-metric-value" style={{ color: UTIL_COLOR[level] }}>{fmt(line.utilized)}</span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Available</span>
            <span className="cl-metric-value" style={{ color: COLOR.success }}>{fmt(line.limit - line.utilized)}</span>
          </div>
        </div>

        <div className="cl-util-bar">
          <div className="cl-util-header">
            <span>Utilization</span>
            <span style={{ color: UTIL_COLOR[level] }}>{pct}%</span>
          </div>
          <div className="cl-util-track">
            <div className="cl-util-fill" style={{ width: `${pct}%`, background: UTIL_COLOR[level] }} />
          </div>
        </div>

        <div className="cl-details">
          <div className="cl-detail">
            <span className="label">APR</span>
            <span className="value">{line.apr}%</span>
          </div>
          <div className="cl-detail">
            <span className="label">Risk Score</span>
            <span className="value">{line.riskScore}</span>
          </div>
          <div className="cl-detail">
            <span className="label">Opened</span>
            <span className="value">{fmtDate(line.openedAt)}</span>
          </div>
        </div>
      </div>

      <div className="cl-card-footer">
        {line.status === 'Active' && line.limit > line.utilized && (
          <Link to={`/draw-credit?line=${line.id}`} className="cl-action-btn draw">
            ↗ Draw
          </Link>
        )}
        {line.utilized > 0 && (
          <button className="cl-action-btn repay">↙ Repay</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CreditLines() {
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<CreditLineStatus | 'all'>('all');

  const creditLines = MOCK_CREDIT_LINES;

  const filteredAndSorted = useMemo(() => {
    let filtered = statusFilter === 'all'
      ? creditLines
      : creditLines.filter(cl => cl.status === statusFilter);

    return [...filtered].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'limit':
          aVal = a.limit;
          bVal = b.limit;
          break;
        case 'utilization':
          aVal = a.utilized / a.limit;
          bVal = b.utilized / b.limit;
          break;
        case 'updatedAt':
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        case 'apr':
          aVal = a.apr;
          bVal = b.apr;
          break;
        case 'riskScore':
          aVal = a.riskScore;
          bVal = b.riskScore;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [creditLines, sortField, sortDir, statusFilter]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="credit-lines-page">
      <div className="cl-page-header">
        <div>
          <h1>Credit Lines</h1>
          <p className="subtitle">Manage your credit facilities</p>
        </div>
        <Link to="/open-credit" className="cl-primary-btn">
          + Open New Line
        </Link>
      </div>

      <div className="cl-filters">
        <div className="cl-filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CreditLineStatus | 'all')}>
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Defaulted">Defaulted</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div className="cl-filter-group">
          <label>Sort By</label>
          <select value={sortField} onChange={(e) => handleSort(e.target.value as SortField)}>
            <option value="updatedAt">Last Updated</option>
            <option value="status">Status</option>
            <option value="limit">Credit Limit</option>
            <option value="utilization">Utilization</option>
            <option value="apr">APR</option>
            <option value="riskScore">Risk Score</option>
          </select>
        </div>
        <button
          className="cl-sort-dir"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon">💳</div>
          <h3>No credit lines found</h3>
          <p>Apply for a credit line to get started</p>
          <Link to="/open-credit" className="cl-primary-btn">
            Open Credit Line
          </Link>
        </div>
      ) : (
        <div className="cl-grid">
          {filteredAndSorted.map(line => (
            <CreditLineCard key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}