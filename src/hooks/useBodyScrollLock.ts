/**
 * Locks body scroll while a modal/overlay is open.
 * Prevents background content from scrolling on mobile/desktop.
 * Restores scroll position and styles on close.
 *
 * Supports nested locks (e.g. nested modals or drawers) via reference-counting:
 * body styles and scroll position are captured on first lock and only restored
 * once all active locks have been released.
 */

import { useEffect } from 'react';

export interface UseBodyScrollLockOptions {
  /** Whether to lock scroll */
  isLocked: boolean;
}

let lockCount = 0;
let preservedScrollY = 0;
let originalStyles: {
  overflow: string;
  position: string;
  width: string;
  top: string;
} | null = null;

/**
 * Resets lock state and styles — for unit testing isolation only.
 */
export function _resetBodyScrollLockForTesting() {
  lockCount = 0;
  preservedScrollY = 0;
  originalStyles = null;
}

export function useBodyScrollLock(options: UseBodyScrollLockOptions | boolean) {
  const isLocked = typeof options === 'boolean' ? options : Boolean(options?.isLocked);

  useEffect(() => {
    if (!isLocked) return;

    if (typeof document === 'undefined') return;

    // Capture initial scroll and styles on first lock transition
    if (lockCount === 0) {
      preservedScrollY = typeof window !== 'undefined' ? (window.scrollY ?? window.pageYOffset ?? 0) : 0;
      originalStyles = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        width: document.body.style.width,
        top: document.body.style.top,
      };

      // Lock scroll and fix body position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${preservedScrollY}px`;
    }

    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      // Only restore styles and scroll when the last lock is released
      if (lockCount === 0) {
        if (originalStyles) {
          document.body.style.overflow = originalStyles.overflow;
          document.body.style.position = originalStyles.position;
          document.body.style.width = originalStyles.width;
          document.body.style.top = originalStyles.top;
          originalStyles = null;
        }

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
          window.scrollTo(0, preservedScrollY);
        }
      }
    };
  }, [isLocked]);
}
