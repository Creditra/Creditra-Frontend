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

export function useInertBackdrop({ isInert, modalId }: UseInertBackdropOptions) {
  useEffect(() => {
    if (!isInert) return;

    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Find all sibling elements that should be made inert
    // Strategy: make all direct children of body inert except the modal container
    const body = document.body;
    const elementsToInert: Element[] = [];
    const originalStates: { element: Element; inert: boolean | null; ariaHidden: string | null }[] = [];

    // Walk through siblings and ancestors
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, null);
    let currentNode = walker.nextNode() as Element | null;

    while (currentNode) {
      // Skip the modal itself and its descendants
      if (modal.contains(currentNode) || currentNode === modal) {
        currentNode = walker.nextNode() as Element | null;
        continue;
      }

      // Skip script, style, link, meta tags
      const tagName = currentNode.tagName.toLowerCase();
      if (['script', 'style', 'link', 'meta', 'noscript'].includes(tagName)) {
        currentNode = walker.nextNode() as Element | null;
        continue;
      }

      elementsToInert.push(currentNode);
      originalStates.push({
        element: currentNode,
        inert: currentNode.hasAttribute('inert') ? true : null,
        ariaHidden: currentNode.getAttribute('aria-hidden'),
      });

      // Apply inert
      if ('inert' in HTMLElement.prototype) {
        (currentNode as HTMLElement).inert = true;
      } else {
        // Fallback for older browsers: aria-hidden + pointer-events
        currentNode.setAttribute('aria-hidden', 'true');
        (currentNode as HTMLElement).style.pointerEvents = 'none';
      }

      currentNode = walker.nextNode() as Element | null;
    }

    return () => {
      // Restore original states
      originalStates.forEach(({ element, inert, ariaHidden }) => {
        if ('inert' in HTMLElement.prototype) {
          if (inert === null) {
            (element as HTMLElement).removeAttribute('inert');
          } else {
            (element as HTMLElement).inert = true;
          }
        } else {
          if (ariaHidden === null) {
            element.removeAttribute('aria-hidden');
          } else {
            element.setAttribute('aria-hidden', ariaHidden);
          }
          (element as HTMLElement).style.pointerEvents = '';
        }
      });
    };
  }, [isInert, modalId]);
}