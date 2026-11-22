import { CopyToClipboard } from '../components/CopyToClipboard';
import { DashboardActivity } from '../components/dashboard/DashboardActivity';
import { DashboardCompare } from '../components/dashboard/DashboardCompare';
import {
  DashboardSummary,
  DashboardSummaryMetrics,
} from '../components/dashboard/DashboardSummary';
import { DashboardTourSection } from '../components/dashboard/DashboardTourSection';
import { EmptyState } from '../components/EmptyState';
import { KbdHint } from '../components/KbdHint';
import { LiveRegion } from '../components/LiveRegion';
import { NoLines } from '../components/illustrations';
import { HealthTipsPanel } from '../components/HealthTipsPanel';
import {
  DashboardDataProvider,
  useDashboardDataContext,
} from '../hooks/useDashboardData';
import { useCompareSelection } from '../hooks/useCompareSelection';
import { useDashboardTour } from '../hooks/useDashboardTour';
import './Dashboard.css';
import '../styles/focus.css';

export { RiskGauge } from './RiskGauge';

export function Dashboard() {
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  );
}

function DashboardContent() {
  const {
    wallet,
    status,
    creditError,
    announcement,
    statusAnnouncement,
    refetchCreditLines,
    isConnected,
    truncAddr,
    hasLines,
  } = useDashboardDataContext();
  const compareSelection = useCompareSelection();
  const dashboardTour = useDashboardTour();

  if ((status === 'success' && !hasLines) || status === 'idle') {
    return (
      <>
        <LiveRegion
          message={announcement || statusAnnouncement}
          aria-live="polite"
        />
        <div className="dashboard-header">
          <div>
            <h1
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              Dashboard
              <KbdHint
                keys={['Cmd', 'K']}
                separator="+"
                label="Command Palette"
                variant="badge"
              />
            </h1>
            <p className="subtitle">Your credit overview at a glance</p>
          </div>
          {isConnected && wallet && (
            <div className="wallet-info">
              <CopyToClipboard
                value={wallet.publicKey}
                displayValue={truncAddr}
                ariaLabel="Copy connected wallet address"
                variant="surface"
                className="wallet-address-chip"
                valueClassName="wallet-address-value"
              />
              <span
                className={`network-badge ${wallet.network === 'TESTNET' ? 'testnet' : 'mainnet'}`}
                title={
                  wallet.network === 'TESTNET'
                    ? 'Testnet (no real funds)'
                    : 'Mainnet (real funds)'
                }
                aria-label={
                  wallet.network === 'TESTNET'
                    ? 'Testnet network (test funds)'
                    : 'Mainnet network (real funds)'
                }
              >
                <span className="dot" />
                <span className="network-icon" aria-hidden="true">
                  {wallet.network === 'TESTNET' ? '⚠️' : '✅'}
                </span>
                {wallet.network === 'TESTNET' ? 'Testnet' : 'Mainnet'}
              </span>
            </div>
          )}
        </div>
        <EmptyState
          illustration={<NoLines className="empty-state-illustration--muted" />}
          title="No credit lines yet"
          description="Start your credit journey by requesting a credit evaluation. We'll analyze your on-chain activity to determine your credit limit and terms."
          primaryAction={{
            label: 'Request Credit Evaluation',
            to: '/open-credit',
          }}
        />
      </>
    );
  }

  return (
    <div aria-busy={status === 'loading'} className="dashboard-root">
      <LiveRegion
        message={announcement || statusAnnouncement}
        aria-live={status === 'error' ? 'assertive' : 'polite'}
      />
      {status === 'error' && (
        <div role="alert" className="dashboard-error-card">
          <p>{creditError?.message ?? 'Unable to load credit data.'}</p>
          <button
            type="button"
            onClick={() => void refetchCreditLines().catch(() => undefined)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="dashboard-header">
        <div>
          <h1
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            Dashboard
            <KbdHint
              keys={['Cmd', 'K']}
              separator="+"
              label="Command Palette"
              variant="badge"
            />
          </h1>
          <p className="subtitle">Your credit overview at a glance</p>
        </div>
        {isConnected && wallet && (
          <div className="wallet-info">
            <CopyToClipboard
              value={wallet.publicKey}
              displayValue={truncAddr}
              ariaLabel="Copy connected wallet address"
              variant="surface"
              className="wallet-address-chip"
              valueClassName="wallet-address-value"
            />
            <span
              className={`network-badge ${wallet.network === 'TESTNET' ? 'testnet' : 'mainnet'}`}
              title={
                wallet.network === 'TESTNET'
                  ? 'Testnet (no real funds)'
                  : 'Mainnet (real funds)'
              }
              aria-label={
                wallet.network === 'TESTNET'
                  ? 'Testnet network (test funds)'
                  : 'Mainnet network (real funds)'
              }
            >
              <span className="dot" />
              <span className="network-icon" aria-hidden="true">
                {wallet.network === 'TESTNET' ? '⚠️' : '✅'}
              </span>
              {wallet.network === 'TESTNET' ? 'Testnet' : 'Mainnet'}
            </span>
          </div>
        )}
      </div>

      <DashboardSummary />

      <div className="dashboard-grid">
        <div>
          <DashboardSummaryMetrics
            isExplainOpen={dashboardTour.isExplainOpen}
            explainTriggerRef={dashboardTour.explainTriggerRef}
            openExplain={dashboardTour.openExplain}
          />
          <DashboardCompare {...compareSelection} />
        </div>
        <DashboardActivity />
        <HealthTipsPanel />
      </div>

      <DashboardTourSection
        isExplainOpen={dashboardTour.isExplainOpen}
        explainTriggerRef={dashboardTour.explainTriggerRef}
        closeExplain={dashboardTour.closeExplain}
      />
    </div>
  );
}
