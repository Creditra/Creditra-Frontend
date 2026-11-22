/**
 * Returns `true` when the event target is a text-entry surface where a
 * single-letter keyboard shortcut must not fire.
 *
 * Covers `<input>`, `<textarea>`, `<select>` and any `contenteditable`
 * element (including nested elements inside one).
 *
 * Shared by the global shortcut handler in `App.tsx` and the Profile
 * activity refresh shortcut in `ProfileActivity.tsx`.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}
