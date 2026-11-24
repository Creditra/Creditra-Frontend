/**
 * TrustBadges — unit tests
 *
 * Coverage:
 *  - Default render: all three badges are present with correct labels
 *  - Accessibility: role="list", aria-label on container, icons are aria-hidden
 *  - BEM modifier classes are applied per variant
 *  - Custom badge set overrides defaults
 *  - Empty badge set renders an empty list (no badges, no crash)
 *  - Integration: TrustBadges appears on LoginPage below the form card
 */

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TrustBadges } from '../TrustBadges';
import type { TrustBadge } from '../TrustBadges';
import { LoginPage } from '../../pages/LoginPage';
import { WalletProvider } from '../../context/WalletContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderTrustBadges(props?: Partial<React.ComponentProps<typeof TrustBadges>>) {
  return render(<TrustBadges {...props} />);
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <WalletProvider initialWallet={null}>
        <LoginPage />
      </WalletProvider>
    </MemoryRouter>,
  );
}

// ─── Default render ───────────────────────────────────────────────────────────

describe('TrustBadges — default render', () => {
  it('renders all three default badges', () => {
    renderTrustBadges();

    expect(screen.getByText('Audited contract')).toBeInTheDocument();
    expect(screen.getByText('Secure connection')).toBeInTheDocument();
    expect(screen.getByText('Open source')).toBeInTheDocument();
  });

  it('renders exactly three list items by default', () => {
    renderTrustBadges();

    const list = screen.getByRole('list', { name: /security assurances/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('TrustBadges — accessibility', () => {
  it('exposes a list role so screen readers announce item count', () => {
    renderTrustBadges();

    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('has an accessible name on the container for screen reader context', () => {
    renderTrustBadges();

    expect(
      screen.getByRole('list', { name: /security assurances/i }),
    ).toBeInTheDocument();
  });

  it('renders SVG icons with aria-hidden so they are not announced', () => {
    renderTrustBadges();

    // All SVG elements inside the component should be hidden from AT.
    const svgs = document.querySelectorAll('.trust-badges__icon svg');
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('badge labels are visible text (not icon-only)', () => {
    renderTrustBadges();

    // Each badge has a text node that is visible — meaning assistive technology
    // can surface it without depending on the icon at all.
    const list = screen.getByRole('list', { name: /security assurances/i });
    const items = within(list).getAllByRole('listitem');

    for (const item of items) {
      expect(item.textContent?.trim()).toBeTruthy();
    }
  });
});

// ─── BEM modifier classes ─────────────────────────────────────────────────────

describe('TrustBadges — BEM modifier classes', () => {
  it('applies the audit modifier to the "Audited contract" badge', () => {
    renderTrustBadges();

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    const auditBadge = items.find((el) => el.textContent?.includes('Audited contract'));

    expect(auditBadge).toBeDefined();
    expect(auditBadge).toHaveClass('trust-badges__badge--audit');
  });

  it('applies the secure modifier to the "Secure connection" badge', () => {
    renderTrustBadges();

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    const secureBadge = items.find((el) => el.textContent?.includes('Secure connection'));

    expect(secureBadge).toBeDefined();
    expect(secureBadge).toHaveClass('trust-badges__badge--secure');
  });

  it('applies the open-source modifier to the "Open source" badge', () => {
    renderTrustBadges();

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    const osBadge = items.find((el) => el.textContent?.includes('Open source'));

    expect(osBadge).toBeDefined();
    expect(osBadge).toHaveClass('trust-badges__badge--open-source');
  });

  it('all badges have the base trust-badges__badge class', () => {
    renderTrustBadges();

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    for (const item of items) {
      expect(item).toHaveClass('trust-badges__badge');
    }
  });
});

// ─── Custom badge set ─────────────────────────────────────────────────────────

describe('TrustBadges — custom badge set', () => {
  const customBadges: TrustBadge[] = [
    {
      id: 'custom-1',
      label: 'Custom badge A',
      variant: 'audit',
      icon: <span aria-hidden="true">🔒</span>,
    },
    {
      id: 'custom-2',
      label: 'Custom badge B',
      variant: 'secure',
      icon: <span aria-hidden="true">✅</span>,
    },
  ];

  it('renders custom badges instead of defaults', () => {
    renderTrustBadges({ badges: customBadges });

    expect(screen.getByText('Custom badge A')).toBeInTheDocument();
    expect(screen.getByText('Custom badge B')).toBeInTheDocument();

    // Default badges should NOT be present
    expect(screen.queryByText('Audited contract')).not.toBeInTheDocument();
    expect(screen.queryByText('Secure connection')).not.toBeInTheDocument();
    expect(screen.queryByText('Open source')).not.toBeInTheDocument();
  });

  it('renders the correct number of custom badges', () => {
    renderTrustBadges({ badges: customBadges });

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(customBadges.length);
  });
});

// ─── Empty badge set ──────────────────────────────────────────────────────────

describe('TrustBadges — empty badge set', () => {
  it('renders an empty list without crashing', () => {
    renderTrustBadges({ badges: [] });

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0);
  });
});

// ─── className prop ───────────────────────────────────────────────────────────

describe('TrustBadges — className prop', () => {
  it('appends an extra class to the container', () => {
    renderTrustBadges({ className: 'my-extra-class' });

    const list = screen.getByRole('list');
    expect(list).toHaveClass('trust-badges');
    expect(list).toHaveClass('my-extra-class');
  });
});

// ─── LoginPage integration ────────────────────────────────────────────────────

describe('TrustBadges — LoginPage integration', () => {
  it('renders the trust badges on the login page', () => {
    renderLoginPage();

    expect(
      screen.getByRole('list', { name: /security assurances/i }),
    ).toBeInTheDocument();
  });

  it('shows all three default badges on the login page', () => {
    renderLoginPage();

    expect(screen.getByText('Audited contract')).toBeInTheDocument();
    expect(screen.getByText('Secure connection')).toBeInTheDocument();
    expect(screen.getByText('Open source')).toBeInTheDocument();
  });

  it('trust badges appear after the form card in the DOM', () => {
    renderLoginPage();

    // The LoginPage <form> has no accessible name, so it doesn't get the
    // implicit ARIA "form" role. Query it directly by tag name instead.
    const form = document.querySelector('form');
    const badgeList = screen.getByRole('list', { name: /security assurances/i });

    // Both elements must exist
    expect(form).not.toBeNull();
    expect(badgeList).toBeInTheDocument();

    // The badge list must follow the form in document order
    expect(
      // eslint-disable-next-line no-bitwise
      form!.compareDocumentPosition(badgeList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
