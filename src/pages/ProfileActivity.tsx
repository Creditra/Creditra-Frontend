import { useCallback, useEffect, useRef, useState } from 'react';
import { KbdHint } from '../components/KbdHint';
import ActivityTimeline from '../components/ActivityTimeline';
import './ProfileActivity.css';

export function ProfileActivity() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setAnnouncement('Activity feed refreshed');
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncement(''), 3000);
  }, []);

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'r' && e.key !== 'R') return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      handleRefresh();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh]);

  useEffect(() => {
    return () => {
      if (announcementTimer.current) clearTimeout(announcementTimer.current);
    };
  }, []);

  return (
    <div className="profile-activity-page">
      <div className="profile-activity-header">
        <h1 className="profile-activity-title">Profile Activity</h1>
        <button
          type="button"
          className="profile-activity-refresh-btn"
          onClick={handleRefresh}
          aria-label="Refresh activity feed"
        >
          <span className="profile-activity-btn-content">
            Refresh
            <KbdHint keys="R" description="Refresh activity feed" />
          </span>
        </button>
      </div>

      <ActivityTimeline key={refreshKey} />

      {announcement && (
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>
      )}
    </div>
  );
}

export default ProfileActivity;
