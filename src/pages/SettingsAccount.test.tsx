import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsAccount } from './SettingsAccount';

describe('SettingsAccount', () => {
  it('renders the heading and children', () => {
    render(
      <SettingsAccount>
        <button>Change password</button>
      </SettingsAccount>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Account Settings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change password' }),
    ).toBeInTheDocument();
  });

  it('uses main landmark with aria-labelledby', () => {
    const { container } = render(
      <SettingsAccount>
        <span>Content</span>
      </SettingsAccount>,
    );
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('aria-labelledby', 'settings-account-heading');
  });

  // ─── Reduced-motion CSS tests ───────────────────────────────────────────

  describe('reduced-motion CSS rules', () => {
    const cssPath = resolve(__dirname, './SettingsAccount.css');
    const css = readFileSync(cssPath, 'utf-8');

    it('contains @media (prefers-reduced-motion: reduce) block', () => {
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('disables transition on .settings-account__collapsible under prefers-reduced-motion', () => {
      const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(rmBlock).toMatch(/\.settings-account__collapsible\s*\{[^}]*transition:\s*none/);
    });

    it('disables transition on .settings-account__toggle under prefers-reduced-motion', () => {
      const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(rmBlock).toMatch(/\.settings-account__toggle\s*\{[^}]*transition:\s*none/);
    });

    it('disables transition on .settings-account__chevron under prefers-reduced-motion', () => {
      const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(rmBlock).toMatch(/\.settings-account__chevron\s*\{[^}]*transition:\s*none/);
    });

    it('disables transition on .settings-account__panel under prefers-reduced-motion', () => {
      const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(rmBlock).toMatch(/\.settings-account__panel\s*\{[^}]*transition:\s*none/);
    });

    it('contains [data-motion="reduced"] block', () => {
      expect(css).toContain('[data-motion="reduced"]');
    });

    it('disables transition on .settings-account__collapsible under [data-motion="reduced"]', () => {
      const pattern = /\[data-motion=["']reduced["']\]\s*\.settings-account__collapsible\s*\{[^}]*transition:\s*none/;
      expect(css).toMatch(pattern);
    });

    it('disables transition on .settings-account__toggle under [data-motion="reduced"]', () => {
      const pattern = /\[data-motion=["']reduced["']\]\s*\.settings-account__toggle\s*\{[^}]*transition:\s*none/;
      expect(css).toMatch(pattern);
    });

    it('disables transition on .settings-account__chevron under [data-motion="reduced"]', () => {
      const pattern = /\[data-motion=["']reduced["']\]\s*\.settings-account__chevron\s*\{[^}]*transition:\s*none/;
      expect(css).toMatch(pattern);
    });

    it('disables transition on .settings-account__panel under [data-motion="reduced"]', () => {
      const pattern = /\[data-motion=["']reduced["']\]\s*\.settings-account__panel\s*\{[^}]*transition:\s*none/;
      expect(css).toMatch(pattern);
    });
  });
});
