/**
 * useQuoteCountdown
 *
 * Manages countdown timer for quote expiry with accessibility announcements.
 *
 * Features:
 * - Computes remaining time using server time (expiresAt) to handle clock skew
 * - Announces countdown at 15 seconds remaining via aria-live="polite"
 * - Returns isExpired flag that respects 5s skew tolerance in favor of expiry
 * - Respects reduced motion preferences (no animation)
 * - Updates every second while quote is active
 *
 * @param expiresAt - ISO 8601 timestamp when the quote expires
 * @param isReducedMotion - Whether reduced motion is active
 * @returns Object with remainingSeconds, formattedTime, isExpired, announcement
 */

import { useState, useEffect, useRef } from 'react';

interface UseQuoteCountdownResult {
  /** Remaining seconds until expiry (clamped to 0). */
  remainingSeconds: number;
  /** Formatted time string like "0:45" or "1:23". */
  formattedTime: string;
  /** True when quote has expired (with 5s skew tolerance). */
  isExpired: boolean;
  /** Announcement message for aria-live (only set at 15s). */
  announcement: string;
}

/**
 * Format seconds as M:SS (e.g., "0:45", "1:23").
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function useQuoteCountdown(
  expiresAt: string | null | undefined,
  isReducedMotion: boolean = false,
): UseQuoteCountdownResult {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const hasAnnouncedRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      setIsExpired(true);
      return;
    }

    // Parse expiry time
    const expiryTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryTime)) {
      setRemainingSeconds(0);
      setIsExpired(true);
      return;
    }

    // Reset announcement flag when new quote arrives
    hasAnnouncedRef.current = false;
    setAnnouncement('');

    const updateCountdown = () => {
      const now = Date.now();
      // Apply 5s clock skew tolerance in favor of expiry
      const timeLeft = expiryTime - now - 5000;
      const secondsLeft = Math.max(0, Math.floor(timeLeft / 1000));

      setRemainingSeconds(secondsLeft);
      setIsExpired(secondsLeft <= 0);

      // Announce at 15 seconds remaining (only once)
      if (secondsLeft === 15 && !hasAnnouncedRef.current) {
        hasAnnouncedRef.current = true;
        setAnnouncement('Quote expires in 15 seconds');
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const formattedTime = formatTime(remainingSeconds);

  return {
    remainingSeconds,
    formattedTime,
    isExpired,
    announcement,
  };
}
