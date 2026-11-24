import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePrivacyMode } from '../context/PrivacyContext';
import './PrivacyModeToggle.css';

/**
 * Header control for the app-wide privacy mode.
 *
 * `aria-pressed` communicates the on/off state; a polite live region repeats
 * the new state after a change so the toggle is announced reliably.
 */
export function PrivacyModeToggle({ className = '' }: { className?: string }) {
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const description = privacyMode
    ? 'Privacy mode on — amounts are hidden'
    : 'Privacy mode off — amounts are visible';
  const [announcement, setAnnouncement] = useState('');
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setAnnouncement(description);
  }, [description]);

  return (
    <>
      <button
        type="button"
        className={`privacy-toggle ${className}`.trim()}
        aria-pressed={privacyMode}
        aria-label="Privacy mode"
        title={description}
        onClick={togglePrivacyMode}
      >
        <span className="privacy-toggle__icon" aria-hidden="true">
          {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
        </span>
        <span className="privacy-toggle__label">Privacy</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
