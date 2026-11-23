import { Link } from 'react-router-dom';
import { Skeleton } from './Skeleton';
import { COLOR, fmt } from '../utils/tokens';
import type { Transaction, TransactionType } from '../types/creditLine';
import './RecentTransactionsRail.css';

type RichTransaction = Transaction & { lineName: string; lineId: string };

interface RecentTransactionsRailProps {
  transactions: RichTransaction[];
  isLoading?: boolean;
  /**
   * A value that changes when the active filters change. When this value changes,
   * the component is remounted so any internal state (e.g., history cursors,
   * scroll offsets) is reset. Pass e.g. a serialized query or filter id.
   */
  filterKey?: string | number;
}

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TX_ICON: Record<TransactionType, string> = {
  Draw: '\u2197',
  Repay: '\u2199',
  Fee: '\uD03D\uDDEB',
  Interest: '\uD3CD\uDDC8',
  StatusChange: '\uD03D\uDD04',
};

const TX_COLOR: Record<TransactionType, string> = {
  Draw: COLOR.danger,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
  StatusChange: COLOR.muted,
};

const fmtAmount = (type: TransactionType, amount: number) =>
  `${type === 'Repay' ? '+' : '-'}${fmt(amount)}`;

export function RecentTransactionsRail({ transactions, isLoading = false, filterKey }: RecentTransactionsRailProps) {
  return (
    <div key={filterKey} className="recent-transactions-rail" role="region" aria-label="Recent transactions">
      {isLoading ? (
      <>
          <div className="activity-item">
            <Skeleton className="activity-icon" style={{ borderRadius: '6px' }} />
            <div className="activity-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Skeleton style={{ width: '120px', height: '14px', borderRadius: '2px' }} />
              <Skeleton style={{ width: '180px', height: '10px', borderRadius: '2px' }} />
            </div>
            <Skeleton style={{ width: '60px', height: '14px', marginLeft: 'auto', borderRadius: '2px' }} />
          </div>
          <div className="activity-item">
            <Skeleton className="activity-icon" style={{ borderRadius: '6px' }} />
            <div className="activity-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Skeleton style={{ width: '100px', height: '14px', borderRadius: '2px' }} />
              <Skeleton style={{ width: '150px', height: '10px', borderRadius: '2px' }} />
            </div>
            <Skeleton style={{ width: '50px', height: '14px', marginLeft: 'auto', borderRadius: '2px' }} />
          </div>
          <div className="activity-item">
            <Skeleton className="activity-icon" style={{ borderRadius: '6px' }} />
            <div className="activity-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Skeleton style={{ width: '140px', height: '14px', borderRadius: '2px' }} />
              <Skeleton style={{ width: '160px', height: '10px', borderRadius: '2px' }} />
            </div>
            <Skeleton style={{ width: '70px', height: '14px', marginLeft: 'auto', borderRadius: '2px' }} />
          </div>
        </>
      ) : transactions.length === 0 ? (
        <p className="rtr-empty" role="status">
          No transactions yet
        </p>
      ) : (
        <>
          {transactions.map((tx, i) => (
            <div key={`${tx.id}-${i}`} className="activity-item">
              <div
                className="activity-icon"
                style={{
                  background: `${TX_COLOR[tx.type]}15`,
                  color: TX_COLOR[tx.type],
                }}
                aria-hidden="true"
              >
                {TX_ICON[tx.type]}
              </div>
              <div className="activity-content">
                <div className="activity-title">{tx.note || tx.type}</div>
                <div className="activity-sub">{tx.lineName} &middot; {relativeTime(tx.date)}</div>
              </div>
              <div className="activity-amount" style={{ color: TX_COLOR[tx.type] }}>
                {fmtAmount(tx.type, tx.amount)}
              </div>
            </div>
          ))}
          <Link to="/transactions" className="rtr-view-all">
            View all transactions &rarr;
          </Link>
        </>
      )}
    </div>
  );
}
