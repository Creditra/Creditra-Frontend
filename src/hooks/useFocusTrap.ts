import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Ref to the trigger element that opened the modal (for return focus) */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Element to focus when the trap is activated */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
}

const focusTrapStack: symbol[] = [];

/**
 * Query selector for focusable elements within a container.
 * Includes: buttons, links, inputs, selects, textareas, and elements with tabindex="0"
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]',
].join(', ');

/**
 * Trap keyboard focus inside a container while the trap is active.
 *
 * On activation, focus moves to the first focusable element in the
 * container. Tab and Shift+Tab cycle within the container. Escape calls
 * the provided `onEscape` handler. On deactivation, focus returns to
 * `triggerRef` if supplied, otherwise to the element that had focus
 * before the trap was activated.
 *
 * Returns a ref to attach to the container element.
 */
export function useFocusTrap({ isActive, triggerRef, initialFocusRef, onEscape }: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const trapId = useRef(Symbol('focus-trap'));
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  // Store the element that had focus before the modal opened
  useEffect(() => {
    if (isActive) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  // Handle focus trap and Escape key
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    focusTrapStack.push(trapId.current);

    const isTopmostTrap = () => focusTrapStack[focusTrapStack.length - 1] === trapId.current;

    // Get all focusable elements
    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    };

    // Focus the first focusable element when opened
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const focusableElements = getFocusableElements();
    const initialFocus = initialFocusRef?.current ?? focusableElements[0];
    if (initialFocus) {
      // Small delay to ensure DOM is ready
      focusTimer = setTimeout(() => {
        if (isTopmostTrap() && initialFocus.isConnected) initialFocus.focus();
      }, 50);
    }

    // Handle Tab key to trap focus
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostTrap() || event.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      // Shift + Tab: moving backwards
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle Escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (isTopmostTrap() && event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      if (focusTimer !== null) {
        clearTimeout(focusTimer);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
      const wasTopmost = isTopmostTrap();
      const trapIndex = focusTrapStack.lastIndexOf(trapId.current);
      if (trapIndex >= 0) focusTrapStack.splice(trapIndex, 1);
      if (wasTopmost) {
        const trigger = triggerRef?.current;
        const previousElement = previousActiveElement.current;
        const returnTarget = trigger?.isConnected
          ? trigger
          : previousElement?.isConnected
            ? previousElement
            : document.querySelector<HTMLElement>('main');

        if (returnTarget) {
          if (returnTarget.tagName.toLowerCase() === 'main' && !returnTarget.hasAttribute('tabindex')) {
            returnTarget.tabIndex = -1;
          }
          returnTarget.focus();
        }
      }
    };
  }, [initialFocusRef, isActive, triggerRef]);

  return containerRef;
}
