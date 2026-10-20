import React, { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import Tabs, { TabItem } from '../components/Tabs';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import { fmt } from '../utils/tokens';
import './Profile.css';

const ActivityTimeline = lazy(() => import('../components/ActivityTimeline'));

/**
 * Profile page component displaying user information with tab navigation.
 * Tabs: Overview (account summary from demo data) | Activity (activity timeline).
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
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
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
        <Suspense fallback={<div>Loading activity...</div>}>
          <ActivityTimeline />
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
        onTabChange={(tabId) => setActiveTab(tabId as 'overview' | 'activity')}
        ariaLabel="Profile sections"
        tabListClassName="profile-tabs"
        panelClassName="profile-content"
      />
    </div>
  );
};

export default Profile;
