import { X } from 'lucide-react';
import type { CreditLine } from '../types/creditLine';
import { fmt, fmtDate } from '../utils/tokens';

interface CompareLinesPanelProps {
  lines: CreditLine[];
  onClose: () => void;
}

export default function CompareLinesPanel({ lines, onClose }: CompareLinesPanelProps) {
  const [line1, line2] = [...lines].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const renderValue = (label: string, value1: unknown, value2: unknown, formatter?: (v: unknown) => string) => {
    const v1 = formatter ? formatter(value1) : String(value1);
    const v2 = formatter ? formatter(value2) : String(value2);
    const diff = v1 !== v2;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontWeight: 600, borderLeft: diff ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: '0.5rem' }}>{v1}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontWeight: 600, borderLeft: diff ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: '0.5rem' }}>{v2}</div>
        </div>
      </div>
    );
  };

  return (
    <div id="compare-panel" style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '480px',
      height: '100vh',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="compare-lines-title" style={{ margin: 0, fontSize: '1.25rem' }}>Compare Credit Lines</h2>
        <button type="button" aria-label="Close compare panel" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {renderValue('Name', line1.name, line2.name)}
        {renderValue('Status', line1.status, line2.status)}
        {renderValue('Limit', line1.limit, line2.limit, fmt)}
        {renderValue('Utilized', line1.utilized, line2.utilized, fmt)}
        {renderValue('Available', line1.limit - line1.utilized, line2.limit - line2.utilized, fmt)}
        {renderValue('APR', line1.apr, line2.apr, (v) => `${v}%`)}
        {renderValue('Risk Score', line1.riskScore, line2.riskScore)}
        {renderValue('Opened', line1.openedAt, line2.openedAt, fmtDate)}
      </div>
    </div>
  );
}
