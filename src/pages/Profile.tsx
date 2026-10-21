import React, { lazy, Suspense, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Tabs, { TabItem } from '../components/Tabs';
import { Skeleton } from '../components/Skeleton';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import { fmt } from '../utils/tokens';
import './Profile.css';

const ProfileActivity = lazy(() => import('./ProfileActivity'));

/** Valid tab ids, mirrored by the `?tab=` search parameter. */
const TAB_IDS = ['overview', 'activity'] as const;
type TabId = (typeof TAB_IDS)[number];

/** Narrows an arbitrary `?tab=` value to a known tab id. */
function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

/**
 * Profile page component displaying user information with tab navigation.
 * Tabs: Overview (account summary from demo data) | Activity (refreshable feed).
 *
 * The selected tab is driven by the `?tab=` search parameter, making the URL
 * the source of truth: reloads, links, and browser history all agree with it.
 */
function ProfileOverview() {
  const active = MOCK_CREDIT_LINES.filter((l) => l.status === 'Active');
  const totalLimit = MOCK_CREDIT_LINES.reduce((sum, l) => sum + l.limit, 0);
  const totalUtilized = MOCK_CREDIT_LINES.reduce((sum, l) => sum + l.utilized, 0);
  const avgRisk = MOCK_CREDIT_LINES.length
    ? Math.round(MOCK_CREDIT_LINES.reduce((sum, l) => sum + l.riskScore, 0) / MOCK_CREDIT_LINES.length)
    : 0;
  const stats = [
    { label: 'Credit lines', value: `${MOCK_CREDIT_LINES.length} (${active.length} active)` },
    { label: 'Total limit', value: fmt(totalLimit) },
    { label: 'Outstanding', value: fmt(totalUtilized) },
    { label: 'Avg. risk score', value: String(avgRisk) },
  ];
  return (
    <div className="overview-tab">
      <p className="profile-overview-intro">
        Demo borrower account. Connect a wallet to see your own on-chain profile.
      </p>
      <dl className="profile-stats">
        {stats.map((s) => (
          <div key={s.label} className="profile-stat">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="profile-links">
        <Link to="/credit-lines">View credit lines</Link>
        <Link to="/linked-accounts">Linked accounts</Link>
        <Link to="/notification-preferences">Notification preferences</Link>
      </div>
    </div>
  );
}

const Profile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'overview';

  useEffect(() => {
    // An unrecognised `?tab=` value falls back to Overview; rewrite it in place
    // (replace) so the URL never disagrees with the visible tab.
    if (tabParam !== null && !isTabId(tabParam)) {
      setSearchParams({ tab: 'overview' }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      panel: <ProfileOverview />,
    },
    {
      id: 'activity',
      label: 'Activity',
      panel: (
        <Suspense
          fallback={
            <div role="status" aria-label="Loading activity">
              <Skeleton width="100%" height={200} />
            </div>
          }
        >
          <ProfileActivity />
        </Suspense>
      ),
    },
  ];

  return (
    <div className="profile-page">
      <h1 className="profile-title">User Profile</h1>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          if (!isTabId(tabId)) return;
          // Push a new history entry so Back restores the previous tab.
          setSearchParams({ tab: tabId });
        }}
        ariaLabel="Profile sections"
        tabListClassName="profile-tabs"
        panelClassName="profile-content"
      />
    </div>
  );
};

export default Profile;
