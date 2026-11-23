import type { ReactNode } from 'react';
import { KbdHint } from '../components/KbdHint';

export interface NotificationCenterProps {
  /** Notification content to display. */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * NotificationCenter — notification page wrapper with KbdHint shortcut chips.
 *
 * Provides a page-level wrapper for the notification centre, displaying
 * the keyboard shortcut to open it via `KbdHint` so users discover the
 * `Cmd+K` / `Ctrl+K` global shortcut.
 *
 * WCAG 2.1 AA:
 * - KbdHint renders accessible keyboard shortcut badges.
 * - Uses `<section>` with `aria-label`.
 * - Focus rings delegated to `:focus-visible` in index.css.
 *
 * @see KbdHint
 * @see CommandPalette (for Cmd+K integration)
 */
export function NotificationCenter({
  children,
  className = '',
}: NotificationCenterProps) {
  const classes = ['card', 'notification-center', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} aria-label="Notifications">
      <div className="notification-center__header">
        <h2 className="notification-center__title">Notifications</h2>
        <KbdHint
          keys={['Ctrl', 'K']}
          label="Quick open"
          description="Press Ctrl+K to open the command palette"
          variant="badge"
        />
      </div>
      <div className="notification-center__list">{children}</div>
    </section>
  );
}

export default NotificationCenter;
