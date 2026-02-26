import { useState, useMemo } from 'react';
import type { CreditLine, CreditLineStatus, SortField, SortDirection, UtilizationLevel } from '../types/creditLine';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import {
  COLOR, UTIL_COLOR, STATUS_COLOR, RISK_COLOR,
  inputStyle, btn,
  fmt, fmtDate, fmtDateTime,
  getUtilizationLevel, utilizationPct,
} from '../utils/tokens';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CreditLineStatus }) {
  const { bg, color } = STATUS_COLOR[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '0.2rem 0.55rem', borderRadius: 4,
      fontSize: '0.75rem', fontWeight: 500,
      background: bg, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {status}
    </span>
  );
}

// ─── UtilBar ──────────────────────────────────────────────────────────────────

function UtilBar({ utilized, limit }: { utilized: number; limit: number }) {
  const pct = utilizationPct(utilized, limit);
  const level = getUtilizationLevel(utilized, limit);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div style={{ flex: 1, height: 4, background: COLOR.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: UTIL_COLOR[level], borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: COLOR.muted, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── SkeletonRow ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(9)].map((_, i) => (
        <td key={i} style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ height: 13, background: COLOR.border, borderRadius: 4, width: `${50 + (i * 19) % 40}%`, opacity: 0.5 }} />
        </td>
      ))}
    </tr>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  action, creditLine, onConfirm, onCancel,
}: {
  action: 'close' | 'suspend';
  creditLine: CreditLine;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onCancel}>
      <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 8, width: '100%', maxWidth: 420, boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', color: COLOR.text }}>
              {action === 'close' ? 'Close credit line?' : 'Suspend credit line?'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: COLOR.muted }}>{creditLine.name} · {creditLine.id}</p>
          </div>
          <button onClick={onCancel} style={{ ...btn.ghost, padding: '0.2rem 0.5rem' }}>✕</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ margin: '0 0 1.25rem', color: COLOR.muted, fontSize: '0.875rem', lineHeight: 1.6 }}>
            {action === 'close'
              ? 'This is permanent. The credit line will be closed and no further draws will be permitted.'
              : 'The credit line will be suspended. No draws will be allowed until reactivated by an administrator.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={onCancel} style={btn.secondary}>Cancel</button>
            <button onClick={onConfirm} style={action === 'close' ? btn.danger : btn.suspend}>
              {action === 'close' ? 'Close line' : 'Suspend line'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────────────────

function DetailModal({
  creditLine, onClose, onAction,
}: {
  creditLine: CreditLine;
  onClose: () => void;
  onAction: (action: 'draw' | 'repay' | 'close' | 'suspend', cl: CreditLine) => void;
}) {
  const [tab, setTab] = useState<'overview' | 'transactions' | 'history'>('overview');
  const available = creditLine.limit - creditLine.utilized;
  const pct = utilizationPct(creditLine.utilized, creditLine.limit);
  const level = getUtilizationLevel(creditLine.utilized, creditLine.limit);
  const monthlyInterest = (creditLine.utilized * (creditLine.apr / 100)) / 12;

  const tabBtn = (t: typeof tab): React.CSSProperties => ({
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: tab === t ? COLOR.accent : COLOR.muted,
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${tab === t ? COLOR.accent : 'transparent'}`,
    cursor: 'pointer',
    marginBottom: -1,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}>
      <div style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 8, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: COLOR.text }}>{creditLine.name}</h2>
              <StatusBadge status={creditLine.status} />
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: COLOR.muted, fontFamily: 'monospace' }}>{creditLine.id}</p>
          </div>
          <button onClick={onClose} style={{ ...btn.ghost, padding: '0.2rem 0.5rem' }}>✕</button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${COLOR.border}` }}>
          {[
            { label: 'Credit Limit', value: fmt(creditLine.limit), color: COLOR.text },
            { label: 'Utilized', value: fmt(creditLine.utilized), color: UTIL_COLOR[level] },
            { label: 'Available', value: fmt(available), color: COLOR.success },
          ].map((item, i) => (
            <div key={item.label} style={{ padding: '1rem 1.25rem', borderRight: i < 2 ? `1px solid ${COLOR.border}` : undefined }}>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${COLOR.border}`, padding: '0 1.5rem' }}>
          {(['overview', 'transactions', 'history'] as const).map(t => (
            <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {tab === 'overview' && (
            <>
              {/* Utilization bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: COLOR.muted }}>Utilization</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: UTIL_COLOR[level] }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: COLOR.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: UTIL_COLOR[level], borderRadius: 3 }} />
                </div>
              </div>

              {/* Detail grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'APR', value: `${creditLine.apr}%`, color: COLOR.text },
                  { label: 'Risk Score', value: String(creditLine.riskScore), color: RISK_COLOR(creditLine.riskScore) },
                  { label: 'Collateral', value: creditLine.collateral || '—', color: COLOR.text },
                  { label: 'Opened', value: fmtDate(creditLine.openedAt), color: COLOR.text },
                  ...(creditLine.nextPaymentDate ? [
                    { label: 'Next Payment Date', value: fmtDate(creditLine.nextPaymentDate), color: COLOR.text },
                    { label: 'Payment Amount', value: fmt(creditLine.nextPaymentAmount ?? 0), color: COLOR.text },
                  ] : []),
                  { label: 'Last Updated', value: fmtDateTime(creditLine.updatedAt), color: COLOR.muted },
                ].map(d => (
                  <div key={d.label} style={{ background: COLOR.bg, border: `1px solid ${COLOR.border}`, borderRadius: 6, padding: '0.75rem 1rem' }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{d.label}</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: d.color }}>{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Monthly interest */}
              <div style={{ background: COLOR.bg, border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: '1rem 1.25rem' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Interest Estimate</p>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.75rem', fontWeight: 700, color: COLOR.text }}>{fmt(monthlyInterest)}</p>
                <p style={{ margin: 0, fontSize: '0.775rem', color: COLOR.muted }}>
                  Based on {fmt(creditLine.utilized)} utilized at {creditLine.apr}% APR
                </p>
              </div>
            </>
          )}

          {tab === 'transactions' && (
            <div>
              {creditLine.transactions.length === 0 ? (
                <p style={{ color: COLOR.muted, fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>No transactions yet.</p>
              ) : creditLine.transactions.map(tx => {
                const txColor = tx.type === 'Draw' ? COLOR.danger : tx.type === 'Repay' ? COLOR.success : COLOR.muted;
                return (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 0', borderBottom: `1px solid ${COLOR.border}` }}>
                    <div>
                      <p style={{ margin: '0 0 0.15rem', fontSize: '0.875rem', fontWeight: 500, color: COLOR.text }}>{tx.type}</p>
                      {tx.note && <p style={{ margin: 0, fontSize: '0.775rem', color: COLOR.muted }}>{tx.note}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 0.15rem', fontSize: '0.875rem', fontWeight: 600, color: txColor }}>
                        {tx.type === 'Repay' ? '+' : '-'}{fmt(tx.amount)}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.775rem', color: COLOR.muted }}>{fmtDate(tx.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'history' && (
            <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
              <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: COLOR.border }} />
              {creditLine.statusHistory.map((entry, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[entry.status].color, border: `2px solid ${COLOR.surface}` }} />
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', color: COLOR.muted }}>{fmtDate(entry.date)}</p>
                  <StatusBadge status={entry.status} />
                  {entry.note && <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: COLOR.muted }}>{entry.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {creditLine.status !== 'Closed' && (
          <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${COLOR.border}`, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {creditLine.status === 'Active' && (
              <>
                <button style={btn.draw} onClick={() => { onAction('draw', creditLine); onClose(); }}>Draw Funds</button>
                <button style={btn.repay} onClick={() => { onAction('repay', creditLine); onClose(); }}>Make Repayment</button>
                <button style={btn.suspend} onClick={() => { onAction('suspend', creditLine); onClose(); }}>Suspend</button>
              </>
            )}
            {creditLine.status === 'Suspended' && (
              <button style={btn.repay} onClick={() => { onAction('repay', creditLine); onClose(); }}>Make Repayment</button>
            )}
            <button style={{ ...btn.danger, marginLeft: 'auto' }} onClick={() => { onAction('close', creditLine); onClose(); }}>
              Close Line
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</p>
      {hasFilters ? (
        <>
          <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: COLOR.text }}>No credit lines match your filters</p>
          <p style={{ margin: '0 0 1.25rem', color: COLOR.muted, fontSize: '0.875rem' }}>Try adjusting your search or filter criteria.</p>
          <button onClick={onClear} style={btn.secondary}>Clear filters</button>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: COLOR.text }}>No credit lines yet</p>
          <p style={{ margin: '0 0 1.25rem', color: COLOR.muted, fontSize: '0.875rem' }}>Apply for your first credit line to get started.</p>
          <button style={btn.primary}>Apply for Credit Line</button>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CreditLines() {
  const [creditLines, setCreditLines] = useState<CreditLine[]>(MOCK_CREDIT_LINES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CreditLineStatus | 'All'>('All');
  const [utilizationFilter, setUtilizationFilter] = useState<UtilizationLevel | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedLine, setSelectedLine] = useState<CreditLine | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: 'close' | 'suspend'; line: CreditLine } | null>(null);
  const [loading] = useState(false);

  const displayed = useMemo(() => {
    let result = creditLines.filter(cl => {
      const matchSearch = !search
        || cl.name.toLowerCase().includes(search.toLowerCase())
        || cl.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || cl.status === statusFilter;
      const matchUtil = utilizationFilter === 'All' || getUtilizationLevel(cl.utilized, cl.limit) === utilizationFilter;
      return matchSearch && matchStatus && matchUtil;
    });
    result.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortField === 'utilization') { va = a.utilized / a.limit; vb = b.utilized / b.limit; }
      else if (sortField === 'status') { va = a.status; vb = b.status; }
      else if (sortField === 'updatedAt') { va = new Date(a.updatedAt).getTime(); vb = new Date(b.updatedAt).getTime(); }
      else { va = a[sortField] as number; vb = b[sortField] as number; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [creditLines, search, statusFilter, utilizationFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortIndicator = (field: SortField) =>
    sortField !== field
      ? <span style={{ color: COLOR.border, marginLeft: 4 }}>↕</span>
      : <span style={{ color: COLOR.accent, marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const handleAction = (action: 'draw' | 'repay' | 'close' | 'suspend', line: CreditLine) => {
    if (action === 'close' || action === 'suspend') setConfirmAction({ action, line });
    else alert(`${action === 'draw' ? 'Draw funds from' : 'Repay'} ${line.name}`);
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    const newStatus: CreditLineStatus = confirmAction.action === 'close' ? 'Closed' : 'Suspended';
    setCreditLines(prev => prev.map(cl =>
      cl.id !== confirmAction.line.id ? cl : {
        ...cl,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        statusHistory: [...cl.statusHistory, {
          status: newStatus,
          date: new Date().toISOString().split('T')[0],
          note: confirmAction.action === 'close' ? 'Closed by borrower' : 'Suspended by borrower',
        }],
      }
    ));
    setConfirmAction(null);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Status', 'Limit', 'Utilized', 'Available', 'APR', 'Risk Score', 'Updated'];
    const rows = displayed.map(cl => [cl.id, cl.name, cl.status, cl.limit, cl.utilized, cl.limit - cl.utilized, cl.apr, cl.riskScore, cl.updatedAt]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'credit-lines.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setUtilizationFilter('All'); };
  const hasFilters = search !== '' || statusFilter !== 'All' || utilizationFilter !== 'All';

  const activeLines = creditLines.filter(cl => cl.status === 'Active');
  const totalLimit = activeLines.reduce((s, cl) => s + cl.limit, 0);
  const totalUtilized = activeLines.reduce((s, cl) => s + cl.utilized, 0);

  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: COLOR.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${COLOR.border}`,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.875rem 1rem',
    borderBottom: `1px solid ${COLOR.border}`,
    color: COLOR.text,
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  };

  return (
    <>
      {/* Modals */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction.action}
          creditLine={confirmAction.line}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {selectedLine && (
        <DetailModal
          creditLine={selectedLine}
          onClose={() => setSelectedLine(null)}
          onAction={(action, line) => { setSelectedLine(null); handleAction(action, line); }}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700, color: COLOR.text }}>Credit Lines</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: COLOR.muted }}>
            {activeLines.length} active {activeLines.length === 1 ? 'line' : 'lines'} · {fmt(totalLimit - totalUtilized)} available
          </p>
        </div>
        <button onClick={exportCSV} style={btn.secondary}>↓ Export CSV</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Credit Limit', value: fmt(totalLimit), sub: 'across active lines', color: COLOR.accent },
          { label: 'Total Utilized', value: fmt(totalUtilized), sub: `${utilizationPct(totalUtilized, totalLimit || 1)}% of limit`, color: UTIL_COLOR[getUtilizationLevel(totalUtilized, totalLimit || 1)] },
          { label: 'Total Available', value: fmt(totalLimit - totalUtilized), sub: 'ready to draw', color: COLOR.success },
          { label: 'Total Lines', value: String(creditLines.length), sub: `${activeLines.length} active`, color: COLOR.text },
        ].map(card => (
          <div key={card.label} className="card" style={{ marginBottom: 0 }}>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{card.label}</p>
            <p style={{ margin: '0 0 0.2rem', fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: COLOR.muted }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, minWidth: 220 }}
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value as CreditLineStatus | 'All')}>
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Defaulted">Defaulted</option>
          <option value="Closed">Closed</option>
        </select>
        <select style={inputStyle} value={utilizationFilter} onChange={e => setUtilizationFilter(e.target.value as UtilizationLevel | 'All')}>
          <option value="All">All Utilization</option>
          <option value="low">Low (&lt;40%)</option>
          <option value="medium">Medium (40–75%)</option>
          <option value="high">High (&gt;75%)</option>
        </select>
        {hasFilters && <button onClick={clearFilters} style={btn.ghost}>Clear filters</button>}
        {hasFilters && (
          <span style={{ fontSize: '0.8rem', color: COLOR.muted, marginLeft: 'auto' }}>
            {displayed.length} of {creditLines.length} lines
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
        {loading ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        ) : displayed.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Credit Line', field: null },
                    { label: 'Status', field: 'status' as SortField },
                    { label: 'Limit', field: 'limit' as SortField },
                    { label: 'Utilized', field: 'utilization' as SortField },
                    { label: 'Available', field: null },
                    { label: 'APR', field: 'apr' as SortField },
                    { label: 'Risk Score', field: 'riskScore' as SortField },
                    { label: 'Updated', field: 'updatedAt' as SortField },
                    { label: 'Actions', field: null },
                  ].map(col => (
                    <th
                      key={col.label}
                      style={{ ...thStyle, cursor: col.field ? 'pointer' : 'default' }}
                      onClick={col.field ? () => toggleSort(col.field!) : undefined}
                    >
                      {col.label}{col.field && sortIndicator(col.field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(cl => (
                  <tr
                    key={cl.id}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(48,54,61,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Name */}
                    <td style={tdStyle}>
                      <button onClick={() => setSelectedLine(cl)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                        <p style={{ margin: '0 0 0.15rem', fontWeight: 600, color: COLOR.accent, fontSize: '0.875rem' }}>{cl.name}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: COLOR.muted, fontFamily: 'monospace' }}>{cl.id}</p>
                      </button>
                    </td>
                    {/* Status */}
                    <td style={tdStyle}><StatusBadge status={cl.status} /></td>
                    {/* Limit */}
                    <td style={tdStyle}>{fmt(cl.limit)}</td>
                    {/* Utilized */}
                    <td style={tdStyle}>
                      <p style={{ margin: '0 0 0.35rem' }}>{fmt(cl.utilized)}</p>
                      <UtilBar utilized={cl.utilized} limit={cl.limit} />
                    </td>
                    {/* Available */}
                    <td style={{ ...tdStyle, color: COLOR.success }}>{fmt(cl.limit - cl.utilized)}</td>
                    {/* APR */}
                    <td style={tdStyle}>{cl.apr}%</td>
                    {/* Risk Score */}
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: RISK_COLOR(cl.riskScore) }}>{cl.riskScore}</span>
                    </td>
                    {/* Updated */}
                    <td style={{ ...tdStyle, color: COLOR.muted, fontSize: '0.775rem', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(cl.updatedAt)}
                    </td>
                    {/* Actions */}
                    <td style={{ ...tdStyle }}>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <button style={btn.ghost} onClick={() => setSelectedLine(cl)}>Details</button>
                        {cl.status === 'Active' && (
                          <>
                            <button style={btn.draw} onClick={() => handleAction('draw', cl)}>Draw</button>
                            <button style={btn.repay} onClick={() => handleAction('repay', cl)}>Repay</button>
                          </>
                        )}
                        {cl.status === 'Suspended' && (
                          <button style={btn.repay} onClick={() => handleAction('repay', cl)}>Repay</button>
                        )}
                        {(cl.status === 'Active' || cl.status === 'Suspended') && (
                          <button style={btn.danger} onClick={() => handleAction('close', cl)}>Close</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {displayed.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: COLOR.muted }}>
            {displayed.length} credit {displayed.length === 1 ? 'line' : 'lines'}
          </span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button style={{ ...btn.ghost, opacity: 0.4 }} disabled>← Prev</button>
            <button style={{ ...btn.ghost, background: COLOR.border, color: COLOR.text }}>1</button>
            <button style={{ ...btn.ghost, opacity: 0.4 }} disabled>Next →</button>
          </div>
        </div>
      )}

      {/* Extend placeholder styles */}
      <style>{`
        input[placeholder]::placeholder { color: ${COLOR.muted}; }
        select option { background: ${COLOR.surface}; color: ${COLOR.text}; }
      `}</style>
    </>
  );
}