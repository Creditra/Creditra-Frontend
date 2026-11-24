import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CreditLine } from '../types/creditLine';
import { fmt, fmtDate } from '../utils/tokens';
import { MAX_COMPARE, buildComparisonUrl } from '../utils/comparisonSelection';
import './CompareLinesPanel.css';

interface CompareLinesPanelProps {
  lines: CreditLine[];
  onClose: () => void;
}

export default function CompareLinesPanel({ lines, onClose }: CompareLinesPanelProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (lines.length < 2) {
    return null;
  }

  const sortedLines = [...lines]
    .slice(0, MAX_COMPARE)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const renderValue = (
    label: string,
    values: unknown[],
    formatter?: (v: unknown) => string,
  ) => {
    const formatted = values.map((v) => (formatter ? formatter(v) : String(v)));
    const diff = formatted.some((v) => v !== formatted[0]);

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${sortedLines.length}, 1fr)`,
          gap: '1rem',
          padding: '0.75rem 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {formatted.map((v, idx) => (
          <div key={sortedLines[idx].id}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
              {label}
            </div>
            <div
              style={{
                fontWeight: 600,
                borderLeft: diff ? '3px solid var(--accent)' : '3px solid transparent',
                borderInlineStart: diff ? '3px solid var(--accent)' : '3px solid transparent',
                paddingLeft: '0.5rem',
                paddingInlineStart: '0.5rem',
              }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      id="compare-panel"
      className="compare-lines-panel"
      style={{
        position: 'fixed',
        top: 0,
        insetInlineEnd: 0,
        width: sortedLines.length > 2 ? 'min(640px, 100vw)' : 'min(480px, 100vw)',
        height: '100vh',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: '1.25rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <h2 id="compare-lines-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Compare Credit Lines
          </h2>
          <button
            type="button"
            aria-label="Close compare panel"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
            Comparing {sortedLines.length} lines (max {MAX_COMPARE})
          </p>
          <Link
            to={buildComparisonUrl(sortedLines.map((l) => l.id))}
            style={{
              fontSize: '0.8rem',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Full Comparison →
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {renderValue(
          'Name',
          sortedLines.map((l) => l.name),
        )}
        {renderValue(
          'Status',
          sortedLines.map((l) => l.status),
        )}
        {renderValue(
          'Limit',
          sortedLines.map((l) => l.limit),
          fmt,
        )}
        {renderValue(
          'Utilized',
          sortedLines.map((l) => l.utilized),
          fmt,
        )}
        {renderValue(
          'Available',
          sortedLines.map((l) => l.limit - l.utilized),
          fmt,
        )}
        {renderValue(
          'APR',
          sortedLines.map((l) => l.apr),
          (v) => `${v}%`,
        )}
        {renderValue(
          'Risk Score',
          sortedLines.map((l) => l.riskScore),
        )}
        {renderValue(
          'Opened',
          sortedLines.map((l) => l.openedAt),
          fmtDate,
        )}
      </div>
    </div>
  );
}
