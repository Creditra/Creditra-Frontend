import { Link, useNavigate } from 'react-router-dom';
import { CreditLineRowMenu } from '../CreditLineRowMenu';
import { Skeleton } from '../Skeleton';
import { StatusBadge } from '../StatusBadge';
import { useDashboardDataContext } from '../../hooks/useDashboardData';
import type { useCompareSelection } from '../../hooks/useCompareSelection';
import {
  COLOR,
  UTIL_COLOR,
  fmt,
  getUtilizationLevel,
  utilizationPct,
} from '../../utils/tokens';

export function DashboardCompare({
  selectedCompareLines,
  compareTriggerRef,
  handleOpenCompare,
  toggleCompareSelection,
}: ReturnType<typeof useCompareSelection>) {
  const { activeLines, status, animDelay } = useDashboardDataContext();
  const navigate = useNavigate();

  const handleRowRepay = (lineId: string) => navigate(`/repay?line=${lineId}`);
  const handleRowDetails = (lineId: string) =>
    navigate(`/credit-lines?highlight=${lineId}`);
  const handleRowSchedule = (lineId: string) =>
    navigate(`/repayment-schedule?line=${lineId}`);

  return (
    <div
      className="card"
      style={animDelay({ animationDelay: '0.2s' })}
      aria-busy={status === 'loading'}
    >
      <h2>
        <span className="icon">💳</span> Active Credit Lines
        {status === 'success' && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {activeLines.length >= 2 && (
              <button
                ref={compareTriggerRef}
                type="button"
                onClick={handleOpenCompare}
                disabled={selectedCompareLines.length !== 2}
                className="focus-ring"
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    selectedCompareLines.length === 2
                      ? 'var(--accent)'
                      : 'rgba(139,148,158,0.12)',
                  color:
                    selectedCompareLines.length === 2
                      ? '#0d1117'
                      : 'var(--muted)',
                  border: 'none',
                  cursor:
                    selectedCompareLines.length === 2 ? 'pointer' : 'not-allowed',
                  opacity: selectedCompareLines.length === 2 ? 1 : 0.6,
                  transition: 'all 0.15s',
                }}
              >
                Compare Selected ({selectedCompareLines.length}/2)
              </button>
            )}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 400,
                color: COLOR.muted,
              }}
            >
              {activeLines.length} line
              {activeLines.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </h2>
      {status === 'loading' ? (
        <>
          {[0, 1, 2].map((skeleton) => (
            <div className="cl-preview-item" aria-hidden="true" key={skeleton}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  <Skeleton
                    style={{
                      width: skeleton === 0 ? '100px' : skeleton === 1 ? '80px' : '90px',
                      height: 'var(--space-3)',
                      borderRadius: '2px',
                    }}
                  />
                  <Skeleton
                    style={{
                      width: '50px',
                      height: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
                <Skeleton
                  width={skeleton === 0 ? 120 : skeleton === 1 ? 100 : 110}
                  height={10}
                  shape="rounded"
                />
              </div>
              <div
                className="cl-preview-right"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 'var(--space-1)',
                }}
              >
                <Skeleton
                  style={{
                    width: skeleton === 0 ? '80px' : skeleton === 1 ? '70px' : '60px',
                    height: 'var(--space-3)',
                    borderRadius: '2px',
                  }}
                />
                <Skeleton
                  style={{
                    width: skeleton === 0 ? '60px' : skeleton === 1 ? '50px' : '40px',
                    height: '6px',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {activeLines.slice(0, 3).map((line) => {
            const pct = utilizationPct(line.utilized, line.limit);
            const level = getUtilizationLevel(line.utilized, line.limit);
            const isSelected = selectedCompareLines.includes(line.id);
            return (
              <div key={line.id} className="cl-preview-item">
                {activeLines.length >= 2 && (
                  <div
                    style={{
                      paddingRight: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <label
                      className="cl-row-select"
                      style={{
                        margin: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        minWidth: '44px',
                        minHeight: '44px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCompareSelection(line.id)}
                        aria-label={`Select ${line.name} for comparison`}
                        style={{
                          cursor: 'pointer',
                          width: '16px',
                          height: '16px',
                          accentColor: 'var(--accent)',
                        }}
                      />
                    </label>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    <p className="cl-preview-name">{line.name}</p>
                    <StatusBadge status={line.status} />
                  </div>
                  <p className="cl-preview-id">{line.id}</p>
                </div>
                <div className="cl-preview-right">
                  <div className="cl-preview-amount num-tabular">
                    {fmt(line.utilized)}{' '}
                    <span
                      style={{
                        color: COLOR.muted,
                        fontWeight: 400,
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      / {fmt(line.limit)}
                    </span>
                  </div>
                  <div className="cl-preview-bar">
                    <div
                      className={`cl-preview-bar-fill util-fill--${level}`}
                      style={{
                        width: `${pct}%`,
                        background: UTIL_COLOR[level],
                      }}
                    />
                  </div>
                </div>
                <CreditLineRowMenu
                  lineId={line.id}
                  lineName={line.name}
                  onRepay={() => handleRowRepay(line.id)}
                  onSchedule={handleRowSchedule}
                  onDetails={handleRowDetails}
                />
              </div>
            );
          })}
          <Link to="/credit-lines" className="view-all-link">
            View all credit lines →
          </Link>
        </>
      )}
    </div>
  );
}
