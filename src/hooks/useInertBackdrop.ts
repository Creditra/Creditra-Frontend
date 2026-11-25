/**
 * Marks all sibling/parent background content as inert while modal is open.
 * Uses the `inert` attribute (or aria-hidden + pointer-events fallback)
 * to make background content non-interactive and hidden from assistive tech.
 *
 * WCAG 2.1 AA: 4.1.2 (Name, Role, Value)
 */

import { useEffect } from 'react';

interface UseInertBackdropOptions {
  /** Whether to make backdrop inert */
  isInert: boolean;
  /** ID of the modal container (elements outside this are made inert) */
  modalId: string;
}

interface InertState {
  count: number;
  inert: boolean;
  ariaHidden: string | null;
  pointerEvents: string;
}

const inertStates = new WeakMap<Element, InertState>();

function acquireInert(element: Element) {
  const existingState = inertStates.get(element);
  if (existingState) {
    existingState.count += 1;
    return;
  }

  inertStates.set(element, {
    count: 1,
    inert: element.hasAttribute('inert'),
    ariaHidden: element.getAttribute('aria-hidden'),
    pointerEvents: (element as HTMLElement).style.pointerEvents,
  });

  if ('inert' in HTMLElement.prototype) {
    (element as HTMLElement).inert = true;
  } else {
    element.setAttribute('aria-hidden', 'true');
    (element as HTMLElement).style.pointerEvents = 'none';
  }
}

function releaseInert(element: Element) {
  const state = inertStates.get(element);
  if (!state) return;

  state.count -= 1;
  if (state.count > 0) return;

  if ('inert' in HTMLElement.prototype) {
    (element as HTMLElement).inert = state.inert;
  } else {
    if (state.ariaHidden === null) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', state.ariaHidden);
    }
    (element as HTMLElement).style.pointerEvents = state.pointerEvents;
  }

  inertStates.delete(element);
}

/**
 * Make everything outside a given modal container unreachable to both
 * pointer input and assistive technology while the modal is open.
 *
 * Prefers the native `inert` attribute when supported; falls back to
 * `aria-hidden` plus `pointer-events: none` for older browsers. Original
 * attribute values are restored on cleanup so this hook is safe to
 * compose with manually managed `aria-hidden` regions. Overlapping modal
 * locks are reference-counted so a background stays inert until the last
 * modal that depends on the lock closes.
 */
export function useInertBackdrop({ isInert, modalId }: UseInertBackdropOptions) {
  useEffect(() => {
    if (!isInert) return;

    const modal = document.getElementById(modalId);
    if (!modal) return;

    const elementsToInert = new Set<Element>();

    // Inert only siblings outside the modal subtree so we never disable an
    // ancestor that still contains the active dialog.
    let current: Element | null = modal;
    while (current && current !== document.body) {
      const parent: HTMLElement | null = current.parentElement;
      if (!parent) break;

      Array.from(parent.children).forEach((sibling) => {
        if (sibling === current) return;

        const tagName = sibling.tagName.toLowerCase();
        if (['script', 'style', 'link', 'meta', 'noscript'].includes(tagName)) {
          return;
        }

        elementsToInert.add(sibling);
      });

      current = parent;
    }

    elementsToInert.forEach(acquireInert);

    return () => {
      elementsToInert.forEach(releaseInert);
    };
  }, [isInert, modalId]);
}
