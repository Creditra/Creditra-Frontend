import { useEffect, useState, type ReactNode } from 'react';
import { CopyToClipboard } from '../components/CopyToClipboard';
import { NextSteps } from '../components/NextSteps';
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
import { DashboardDataProvider, useDashboardDataContext } from '../hooks/useDashboardData';
import { useCompareSelection } from '../hooks/useCompareSelection';
import { useDashboardTour } from '../hooks/useDashboardTour';
import { useWalletIdentityKey } from '../hooks/useWalletIdentityKey';
import {
  loadDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  type DashboardLayout,
} from '../state/dashboardLayout';
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
    totalAvailable,
    totalUtilized,
  } = useDashboardDataContext();
  const compareSelection = useCompareSelection();
  const dashboardTour = useDashboardTour();
  const walletKey = useWalletIdentityKey();
  const [isCustomising, setIsCustomising] = useState(false);
  const [layoutAnnouncement, setLayoutAnnouncement] = useState('');

  const cardRegistry: Array<{ id: string; title: string; component: ReactNode }> = [
    { id: 'summary', title: 'Credit overview', component: <DashboardSummary /> },
    {
      id: 'next-steps',
      title: 'Next steps',
      component: <NextSteps totalAvailable={totalAvailable} totalUtilized={totalUtilized} />,
    },
    {
      id: 'credit-details',
      title: 'Credit details',
      component: (
        <div>
          <DashboardSummaryMetrics
            isExplainOpen={dashboardTour.isExplainOpen}
            explainTriggerRef={dashboardTour.explainTriggerRef}
            openExplain={dashboardTour.openExplain}
          />
          <DashboardCompare {...compareSelection} />
        </div>
      ),
    },
    { id: 'activity', title: 'Activity', component: <DashboardActivity /> },
    { id: 'health-tips', title: 'Health tips', component: <HealthTipsPanel /> },
  ];
  const cardIds = cardRegistry.map((card) => card.id);
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    loadDashboardLayout(walletKey, cardIds),
  );

  useEffect(() => {
    setLayout(loadDashboardLayout(walletKey, cardIds));
  }, [walletKey]);

  const updateLayout = (next: DashboardLayout, announcement: string) => {
    const saved = saveDashboardLayout(walletKey, next, cardIds);
    setLayout(saved);
    setLayoutAnnouncement(announcement);
  };

  const moveCard = (id: string, direction: -1 | 1) => {
    const index = layout.order.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    const card = cardRegistry.find((item) => item.id === id);
    updateLayout(
      { ...layout, order },
      `${card?.title ?? id} moved ${direction === -1 ? 'up' : 'down'}.`,
    );
  };

  const toggleHidden = (id: string) => {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((hiddenId) => hiddenId !== id)
      : [...layout.hidden, id];
    const card = cardRegistry.find((item) => item.id === id);
    updateLayout(
      { ...layout, hidden },
      hidden.includes(id) ? `${card?.title ?? id} hidden.` : `${card?.title ?? id} restored.`,
    );
  };

  const resetLayout = () => {
    const reset = resetDashboardLayout(walletKey, cardIds);
    setLayout(reset);
    setLayoutAnnouncement('Dashboard layout reset to default.');
  };

  if ((status === 'success' && !hasLines) || status === 'idle') {
    return (
      <>
        <LiveRegion message={announcement || statusAnnouncement} aria-live="polite" />
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
              <KbdHint keys={['Cmd', 'K']} separator="+" label="Command Palette" variant="badge" />
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
                  wallet.network === 'TESTNET' ? 'Testnet (no real funds)' : 'Mainnet (real funds)'
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
          <button type="button" onClick={() => void refetchCreditLines().catch(() => undefined)}>
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
            <KbdHint keys={['Cmd', 'K']} separator="+" label="Command Palette" variant="badge" />
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
                wallet.network === 'TESTNET' ? 'Testnet (no real funds)' : 'Mainnet (real funds)'
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

      <div className="dashboard-customise-bar">
        <button
          type="button"
          className="dashboard-customise-button"
          aria-pressed={isCustomising}
          onClick={() => {
            setIsCustomising((current) => !current);
            setLayoutAnnouncement(
              isCustomising ? 'Customisation mode closed.' : 'Customisation mode opened.',
            );
          }}
        >
          {isCustomising ? 'Done' : 'Customise'}
        </button>
        {isCustomising && (
          <>
            <button type="button" onClick={resetLayout}>
              Reset layout
            </button>
            <div className="dashboard-card-controls" aria-label="Dashboard card layout">
              {layout.order.map((id, index) => {
                const card = cardRegistry.find((item) => item.id === id);
                const isHidden = layout.hidden.includes(id);
                return (
                  <div className="dashboard-card-control" key={id}>
                    <span>{card?.title ?? id}</span>
                    <button
                      type="button"
                      aria-label={`Move ${card?.title ?? id} up`}
                      disabled={index === 0}
                      onClick={() => moveCard(id, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${card?.title ?? id} down`}
                      disabled={index === layout.order.length - 1}
                      onClick={() => moveCard(id, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      aria-label={`${isHidden ? 'Restore' : 'Hide'} ${card?.title ?? id}`}
                      onClick={() => toggleHidden(id)}
                    >
                      {isHidden ? 'Restore' : 'Hide'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <LiveRegion
        message={layoutAnnouncement}
        aria-live="polite"
        id="dashboard-layout-announcement"
      />

      {layout.order.map((cardId) => {
        if (layout.hidden.includes(cardId)) return null;
        const card = cardRegistry.find((c) => c.id === cardId);
        return card ? (
          <div key={card.id} className="dashboard-card">
            {card.component}
          </div>
        ) : null;
      })}

      <DashboardTourSection
        isExplainOpen={dashboardTour.isExplainOpen}
        explainTriggerRef={dashboardTour.explainTriggerRef}
        closeExplain={dashboardTour.closeExplain}
      />
    </div>
  );
}
