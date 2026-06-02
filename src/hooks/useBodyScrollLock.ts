/**
 * Locks body scroll while a modal/overlay is open.
 * Prevents background content from scrolling on mobile/desktop.
 * Restores scroll position and styles on close.
 */

import { useEffect } from 'react';

interface UseBodyScrollLockOptions {
  /** Whether to lock scroll */
  isLocked: boolean;
}

export function useBodyScrollLock({ isLocked }: UseBodyScrollLockOptions) {
  useEffect(() => {
    if (!isLocked) return;

    // Save current scroll position and styles
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalTop = document.body.style.top;

    // Lock scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      // Restore scroll and styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.top = originalTop;

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}