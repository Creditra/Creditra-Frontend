import React, { useState } from 'react';
import { COLOR } from '@/utils/tokens';
import { formatUsd } from '@/utils/currency';
import { usePrivacyMode } from '@/context/PrivacyContext';
import { Amount } from '../Amount';
import type { ScheduleRow } from './types';

export interface ScenarioControlsProps {
  schedule: ScheduleRow[];
  caption?: string;
  limit?: number;
}

const fmt = (n: number) => formatUsd(n, { decimals: 2 });

function SRTable({ schedule, caption }: { schedule: ScheduleRow[]; caption?: string }) {
  const { privacyMode } = usePrivacyMode();
  const termMonths = schedule.length;
  const totalInterest = schedule[schedule.length - 1]?.cumulativeInterest ?? 0;
  const resolvedCaption =
    caption ??
    `Monthly repayment schedule: ${termMonths} month${termMonths !== 1 ? 's' : ''}, ${
      privacyMode ? 'amounts hidden for privacy' : `${formatUsd(totalInterest, { decimals: 0 })} total interest`
    }`;

  return (
    <table
      className="sr-only tabular-nums"
      aria-label="Repayment schedule data table"
      style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--text-xs)' }}
    >
      <caption className="sr-only">{resolvedCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Principal Paid</th>
          <th scope="col">Interest Paid</th>
          <th scope="col">Remaining Principal</th>
          <th scope="col">Cumulative Interest</th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((row) => (
          <tr key={row.month}>
            <td>{row.month}</td>
            <td><Amount value={row.principalPaid} format={fmt} maskedLabel="Principal paid hidden for privacy" /></td>
            <td><Amount value={row.interest} format={fmt} maskedLabel="Interest paid hidden for privacy" /></td>
            <td><Amount value={row.principal} format={fmt} maskedLabel="Remaining principal hidden for privacy" /></td>
            <td><Amount value={row.cumulativeInterest} format={fmt} maskedLabel="Cumulative interest hidden for privacy" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VisibleTable({ schedule, limit = 12 }: { schedule: ScheduleRow[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? schedule : schedule.slice(0, limit);

  const thStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: 'var(--space-2)',
    fontWeight: 'var(--font-semibold)',
    fontSize: 'var(--text-xs)',
    color: `var(--muted, ${COLOR.muted})`,
    borderBottom: `1px solid var(--border, ${COLOR.border})`,
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-xs)',
    color: `var(--text, ${COLOR.text})`,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <table
        aria-label="Repayment schedule"
        className="tabular-nums"
        style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ ...thStyle, textAlign: 'left' }}>Month</th>
            <th scope="col" style={thStyle}>Principal Paid</th>
            <th scope="col" style={thStyle}>Interest</th>
            <th scope="col" style={thStyle}>Remaining</th>
            <th scope="col" style={thStyle}>Cum. Interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.month}
              style={{ background: i % 2 === 0 ? 'transparent' : `var(--surface, ${COLOR.surface})` }}
            >
              <td style={{ ...tdStyle, textAlign: 'left', color: `var(--muted, ${COLOR.muted})` }}>
                {row.month}
              </td>
              <td style={{ ...tdStyle, color: `var(--accent, ${COLOR.accent})` }}>
                <Amount value={row.principalPaid} format={fmt} maskedLabel="Principal paid hidden for privacy" />
              </td>
              <td style={{ ...tdStyle, color: `var(--warning, ${COLOR.warning})` }}>
                <Amount value={row.interest} format={fmt} maskedLabel="Interest paid hidden for privacy" />
              </td>
              <td style={tdStyle}>
                <Amount value={row.principal} format={fmt} maskedLabel="Remaining principal hidden for privacy" />
              </td>
              <td style={tdStyle}>
                <Amount value={row.cumulativeInterest} format={fmt} maskedLabel="Cumulative interest hidden for privacy" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {schedule.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="repayment-visualizer-focus"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: `var(--accent, ${COLOR.accent})`,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-1) 0',
          }}
          aria-expanded={showAll}
        >
          {showAll ? 'Show fewer rows' : `Show all ${schedule.length} months`}
        </button>
      )}
    </div>
  );
}

export function ScenarioControls({ schedule, caption, limit = 12 }: ScenarioControlsProps) {
  return (
    <>
      {/* SR-only full data table (always present for assistive tech) */}
      <SRTable schedule={schedule} caption={caption} />

      {/* Visible table */}
      <details style={{ marginTop: 'var(--space-4)' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            color: `var(--accent, ${COLOR.accent})`,
            userSelect: 'none',
            padding: 'var(--space-1) 0',
          }}
          className="repayment-visualizer-focus"
        >
          Schedule table
        </summary>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <VisibleTable schedule={schedule} limit={limit} />
        </div>
      </details>
    </>
  );
}
