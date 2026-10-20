import type { ReactNode } from 'react';

export interface SettingsAccountProps {
  /** Content to render inside the settings account page. */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * SettingsAccount — settings page wrapper for account-related controls.
 *
 * Provides a consistent layout shell for account settings sections
 * (profile, security, notifications, data export, sessions, etc.).
 * Uses `src/styles/print-settings.css` for clean printed output.
 *
 * WCAG 2.1 AA:
 * - Uses `<main>` landmark with `aria-labelledby`.
 * - Print stylesheets hide interactive chrome.
 * - Focus rings inherited from `:focus-visible` in index.css.
 */
export function SettingsAccount({
  children,
  className = '',
}: SettingsAccountProps) {
  const classes = ['settings-account', className]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={classes} aria-labelledby="settings-account-heading">
      <h1 id="settings-account-heading" className="settings-account__heading">
        Account Settings
      </h1>
      <div className="settings-account__content">{children}</div>
    </main>
  );
}

export default SettingsAccount;
