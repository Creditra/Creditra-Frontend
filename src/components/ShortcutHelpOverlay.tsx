/**
 * ShortcutHelpOverlay
 *
 * Displays all keyboard shortcuts grouped by area when the user presses `?`.
 * Conforms to WCAG 2.1 AA:
 *   - role="dialog" with aria-modal, aria-labelledby, aria-describedby
 *   - Focus trap via useFocusTrap (Tab/Shift-Tab cycling + Escape to close)
 *   - Scroll lock via useBodyScrollLock
 *   - Background content inert via useInertBackdrop
 *   - Keyboard trigger guarded against editable targets (see App.tsx)
 *   - Reduced-motion: entry animation suppressed (see ShortcutHelpOverlay.css)
 */
import { useMemo, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import {
  HOTKEY_SCOPE_LABELS,
  HOTKEY_SCOPE_ORDER,
  useRegisteredHotkeys,
} from '../lib/hotkeys';
import './ShortcutHelpOverlay.css';

interface ShortcutHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the element that triggered the overlay; focus returns here on close. */
  triggerRef?: RefObject<HTMLElement | null>;
}

export function ShortcutHelpOverlay({
  isOpen,
  onClose,
  triggerRef,
}: ShortcutHelpOverlayProps) {
  const MODAL_ID = 'shortcut-help-overlay';

  const containerRef = useFocusTrap({ isActive: isOpen, triggerRef, onEscape: onClose });
  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId: MODAL_ID });

  const registeredHotkeys = useRegisteredHotkeys();
  const shortcutGroups = useMemo(
    () =>
      HOTKEY_SCOPE_ORDER.map((scope) => ({
        scope,
        title: HOTKEY_SCOPE_LABELS[scope],
        shortcuts: registeredHotkeys.filter((h) => h.scope === scope),
      })).filter((group) => group.shortcuts.length > 0),
    [registeredHotkeys],
  );

  if (!isOpen) return null;

  return (
    <div id={MODAL_ID} className="shortcut-help-overlay">
      {/* Backdrop — click outside to dismiss */}
      <div className="shortcut-help-backdrop" aria-hidden="true" onClick={onClose} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        aria-describedby="shortcut-help-desc"
        className="shortcut-help-dialog"
      >
        {/* ── Header ── */}
        <div className="shortcut-help-header">
          <div>
            <p className="shortcut-help-kicker">Keyboard shortcuts</p>
            <h2 id="shortcut-help-title">Move around faster</h2>
            <p id="shortcut-help-desc">
              Press <kbd>?</kbd> outside a text field to reopen this guide.
            </p>
          </div>
          <button
            type="button"
            className="shortcut-help-close"
            aria-label="Close keyboard shortcut help"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* ── Shortcut groups ── */}
        <div className="shortcut-help-groups" role="list">
          {shortcutGroups.map((group) => (
            <section
              key={group.scope}
              role="listitem"
              aria-labelledby={`shortcut-group-${group.scope}`}
              className="shortcut-help-group"
            >
              <h3 id={`shortcut-group-${group.scope}`}>{group.title}</h3>
              <ul>
                {group.shortcuts.map((shortcut) => (
                  <li key={shortcut.id}>
                    {/* Keys are decorative for sighted users; SR reads description only */}
                    <span className="shortcut-help-keys" aria-hidden="true">
                      {shortcut.keys.map((key, index) => (
                        <kbd key={`${key}-${index}`}>{key}</kbd>
                      ))}
                    </span>
                    <span>{shortcut.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="shortcut-help-footer">
          <Link
            className="shortcut-help-settings-link"
            to="/help#shortcuts"
            onClick={onClose}
          >
            Settings and shortcut notes
          </Link>
        </div>
      </div>
    </div>
  );
}
