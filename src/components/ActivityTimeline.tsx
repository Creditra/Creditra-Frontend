import React, { useEffect, useState } from 'react';
import './ActivityTimeline.css';

/**
 * Types for activity entries. Adjust according to your backend schema.
 */
export interface ActivityEntry {
  id: string;
  type: string; // e.g., 'borrow', 'repay', 'payment'
  timestamp: string; // ISO date string
  description: string;
}

/**
 * ActivityTimeline component displays a list of user activities.
 * When `entries` is provided, renders those entries directly; otherwise
 * falls back to the mock fetch.
 */
export interface ActivityTimelineProps {
  filter?: string;
  entries?: ActivityEntry[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ filter, entries }) => {
  const [activities, setActivities] = useState<ActivityEntry[]>(entries ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(entries === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entries !== undefined) {
      setActivities(entries);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setActivities([]);
    setIsLoading(true);
    setError(null);

    // TODO: replace mock data with real API call (e.g., fetch('/api/user/activity'))
    const fetchActivities = async () => {
      try {
        // Simulate network delay
        await new Promise(res => setTimeout(res, 500));
        if (cancelled) return;
        const mockData: ActivityEntry[] = [
          {
            id: '1',
            type: 'borrow',
            timestamp: new Date().toISOString(),
            description: 'Borrowed $5,000 for home improvement',
          },
          {
            id: '2',
            type: 'repay',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            description: 'Repayed $500 installment',
          },
        ];
        setActivities(mockData);
        setIsLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError('Failed to load activity');
        setIsLoading(false);
      }
    };
    fetchActivities();
    return () => {
      cancelled = true;
    };
  }, [filter, entries]);

  if (isLoading) {
    return <div className="activity-loading" aria-live="polite">Loading activity...</div>;
  }

  if (error) {
    return (
      <div className="activity-error" role="alert">
        {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-empty" aria-live="polite">
        No recent activity.
      </div>
    );
  }

  return (
    <ul className="activity-timeline" role="list" aria-label="User activity timeline">
      {activities.map(activity => (
        <li key={activity.id} className="activity-item" role="listitem">
          <div className="activity-type">{activity.type}</div>
          <div className="activity-description">{activity.description}</div>
          <time className="activity-time" dateTime={activity.timestamp}>
            {new Date(activity.timestamp).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
};

export default ActivityTimeline;
