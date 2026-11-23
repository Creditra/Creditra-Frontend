import { useEffect } from 'react';

/**
 * Adds a `beforeunload` listener while `isDirty` is true, so the browser
 * prompts the user before discarding unsaved form input.
 *
 * The listener is removed when `isDirty` becomes false or the component
 * unmounts, so pristine and successfully submitted forms never trigger a prompt.
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
