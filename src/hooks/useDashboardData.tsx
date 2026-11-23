import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useWallet } from '../context/WalletContext';
import { useCreditLines } from './useCreditLines';
import { getBorrowerRiskScore, summarizeCreditLines } from '../lib/credit-summary';
import {
  getDashboardNotifications,
  getRecentDashboardActivity,
} from '../pages/dashboard-utils';
import { useReducedMotion } from '../context/ReducedMotionContext';
import { getUtilizationLevel, utilizationPct } from '../utils/tokens';

export function useDashboardData() {
  const { wallet, status: walletStatus } = useWallet();
  const {
    lines: creditLines,
    status,
    error: creditError,
    lastUpdatedAt: creditSyncedAt,
    refetch: refetchCreditLines,
  } = useCreditLines();
  const activitySyncedAt = creditSyncedAt;
  const { isReducedMotionActive } = useReducedMotion();
  const [announcement, setAnnouncement] = useState('');

  const statusAnnouncement =
    status === 'loading'
      ? 'Loading dashboard data.'
      : status === 'success'
        ? 'Dashboard loaded successfully.'
        : status === 'error'
          ? `Failed to load dashboard: ${creditError?.message ?? 'Unknown error'}`
          : '';

  const handleCreditRefresh = useCallback(async () => {
    try {
      await refetchCreditLines();
      setAnnouncement('Credit summary refreshed successfully.');
    } catch (err) {
      setAnnouncement('Failed to refresh credit summary.');
      throw err;
    }
  }, [refetchCreditLines]);

  const handleActivityRefresh = useCallback(async () => {
    try {
      await refetchCreditLines();
      setAnnouncement('Recent activity refreshed successfully.');
    } catch (err) {
      setAnnouncement('Failed to refresh activity.');
      throw err;
    }
  }, [refetchCreditLines]);

  const activeLines = useMemo(
    () =>
      creditLines.filter(
        (creditLine) =>
          creditLine.status === 'Active' || creditLine.status === 'Suspended',
      ),
    [creditLines],
  );
  const activeLinesOnly = useMemo(
    () => creditLines.filter((creditLine) => creditLine.status === 'Active'),
    [creditLines],
  );
  const riskScoreLines = useMemo(
    () => creditLines.filter((creditLine) => creditLine.status !== 'Closed'),
    [creditLines],
  );
  const borrowerRiskScore = useMemo(
    () => getBorrowerRiskScore(creditLines),
    [creditLines],
  );
  const creditSummary = useMemo(
    () => summarizeCreditLines(creditLines),
    [creditLines],
  );
  const totalLimit = creditSummary.drawableLimit;
  const totalUtilized = creditSummary.totalOutstanding;
  const totalActiveUtilized = activeLinesOnly.reduce(
    (sum, creditLine) => sum + creditLine.utilized,
    0,
  );
  const totalAvailable = creditSummary.availableToDraw;
  const overallPct = utilizationPct(totalActiveUtilized, totalLimit || 1);
  const overallLevel =
    totalLimit > 0
      ? getUtilizationLevel(totalActiveUtilized, totalLimit)
      : 'low';
  const recentActivity = useMemo(
    () => getRecentDashboardActivity(creditLines),
    [creditLines],
  );
  const notifications = useMemo(
    () => getDashboardNotifications(creditLines),
    [creditLines],
  );
  const hasLines = creditLines.length > 0;
  const hasUtilized = totalUtilized > 0;
  const isConnected = walletStatus === 'connected' && wallet;
  const truncAddr = wallet?.publicKey
    ? `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`
    : '';
  const animDelay = useCallback(
    (style: CSSProperties): CSSProperties =>
      isReducedMotionActive ? {} : style,
    [isReducedMotionActive],
  );

  return {
    wallet,
    walletStatus,
    creditLines,
    status,
    creditError,
    creditSyncedAt,
    activitySyncedAt,
    refetchCreditLines,
    announcement,
    setAnnouncement,
    statusAnnouncement,
    handleCreditRefresh,
    handleActivityRefresh,
    activeLines,
    activeLinesOnly,
    riskScoreLines,
    borrowerRiskScore,
    creditSummary,
    totalLimit,
    totalUtilized,
    totalActiveUtilized,
    totalAvailable,
    overallPct,
    overallLevel,
    recentActivity,
    notifications,
    hasLines,
    hasUtilized,
    isConnected,
    truncAddr,
    animDelay,
  };
}

type DashboardData = ReturnType<typeof useDashboardData>;

const DashboardDataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const dashboardData = useDashboardData();
  return (
    <DashboardDataContext.Provider value={dashboardData}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardDataContext(): DashboardData {
  const dashboardData = useContext(DashboardDataContext);
  if (!dashboardData) {
    throw new Error('Dashboard data must be used within DashboardDataProvider');
  }
  return dashboardData;
}
