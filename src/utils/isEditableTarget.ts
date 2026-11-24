/**
 * Input types that do not accept free-form text entry and therefore should
 * not block single-key global shortcuts when focused.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
  'hidden',
]);

/**
 * Returns `true` when the event target is a text-entry surface where a
 * single-letter keyboard shortcut must not fire.
 *
 * Covers text-entry `<input>` elements (e.g. `text`, `search`, `email`, `url`,
 * `tel`, `password`, `number`, `date`, `datetime-local`, `month`, `week`,
 * `time`, or missing/unknown `type`), `<textarea>`, `<select>`, and any
 * `contenteditable` element (including nested elements inside one).
 *
 * Non-text `<input>` types (`checkbox`, `radio`, `button`, `submit`, `reset`,
 * `range`, `color`, `file`, `image`, `hidden`) return `false` so global
 * shortcuts continue to work after interacting with them.
 *
 * Note: `readonly` text inputs are still treated as editable so focus inside
 * a text field consistently suppresses single-key shortcuts.
 *
 * Shared by the global shortcut handler in `App.tsx` and the Profile
 * activity refresh shortcut in `ProfileActivity.tsx`.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const contentEditableAncestor = target.closest('[contenteditable]');
  if (contentEditableAncestor) {
    const attr = contentEditableAncestor
      .getAttribute('contenteditable')
      ?.toLowerCase();
    if (attr === '' || attr === 'true' || attr === 'plaintext-only') {
      return true;
    }
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (tagName === 'input') {
    const inputType = (
      target.getAttribute('type') ??
      (target as HTMLInputElement).type ??
      'text'
    )
      .trim()
      .toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }

  return false;
}
