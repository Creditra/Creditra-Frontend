import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AgingTag } from '../components/AgingTag';
import { EmptyState } from '../components/EmptyState';
import { NoOverdue } from '../components/illustrations';
import { StatusBadge } from '../components/StatusBadge';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import { COLOR, fmt } from '../utils/tokens';
import type { CreditLine } from '../types/creditLine';
import './AgingTag.css';

function daysPastDue(line: CreditLine): number {
  const overdueEntry = line.statusHistory
    .filter((h) => h.status === 'Suspended' || h.status === 'Defaulted')
    .pop();
  if (!overdueEntry) return 0;
  const diff = Math.abs(Date.now() - new Date(overdueEntry.date).getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function CreditLineRow({ line }: { line: CreditLine }) {
  const days = daysPastDue(line);

  return (
    <div className="aging-line-card">
      <div className="aging-line-header">
        <div className="aging-line-title-row">
          <h3 className="aging-line-name">{line.name}</h3>
          <StatusBadge status={line.status} />
        </div>
        <span className="aging-line-id">{line.id}</span>
      </div>

      <div className="aging-line-body">
        <div className="aging-line-metrics">
          <div className="aging-line-metric">
            <span className="aging-line-metric-label">Limit</span>
            <span className="aging-line-metric-value">{fmt(line.limit)}</span>
          </div>
          <div className="aging-line-metric">
            <span className="aging-line-metric-label">Utilized</span>
            <span className="aging-line-metric-value">{fmt(line.utilized)}</span>
          </div>
          <div className="aging-line-metric">
            <span className="aging-line-metric-label">APR</span>
            <span className="aging-line-metric-value">{line.apr}%</span>
          </div>
        </div>

        <div className="aging-line-actions">
          <AgingTag daysPastDue={days} />
          <Link
            to={`/repay?line=${line.id}`}
            className="aging-line-repay-btn"
            style={{
              background: COLOR.accent,
              border: `1px solid ${COLOR.accent}`,
            }}
          >
            Repay Now
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AgingTagPage() {
  const delinquentLines = useMemo(
    () => MOCK_CREDIT_LINES.filter(
      (cl) => cl.status === 'Defaulted' || cl.status === 'Suspended'
    ),
    [],
  );

  const hasDelinquent = delinquentLines.length > 0;

  return (
    <div className="aging-page">
      <div className="aging-page-header">
        <h1>Aging Credit Lines</h1>
        <p className="aging-page-subtitle">
          Credit lines that are past due or require attention
        </p>
      </div>

      {!hasDelinquent ? (
        <EmptyState
          data-testid="aging-empty-state"
          tone="success"
          eyebrow="All caught up"
          illustration={<NoOverdue className="empty-state-illustration--muted" />}
          title="No overdue credit lines"
          description="All your credit lines are current. There are no past-due balances to address right now."
          primaryAction={{ label: 'View Credit Lines', to: '/credit-lines' }}
          secondaryAction={{ label: 'Back to Dashboard', to: '/' }}
        />
      ) : (
        <div className="aging-line-list" data-testid="aging-line-list">
          <div className="aging-line-count" role="status" aria-live="polite">
            {delinquentLines.length} credit line{delinquentLines.length !== 1 ? 's' : ''} past due
          </div>
          {delinquentLines.map((line) => (
            <CreditLineRow key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgingTagPage;
