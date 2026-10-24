/**
 * Profile.url-state.test.tsx
 *
 * Covers the Profile tab URL-state contract:
 *   - `?tab=overview|activity` selects the matching tab.
 *   - Unknown `?tab=` values fall back to Overview and are rewritten in place.
 *   - Clicking a tab pushes `?tab=<id>`.
 *   - The refreshable ProfileActivity panel (and its `R` shortcut) is the
 *     Activity panel, and only while that tab is selected.
 *   - The lazy Activity panel exposes a `role="status"` loading region.
 *   - The command palette offers a "Profile activity" deep link.
 *
 * These tests run against the react-router-dom stub (see
 * src/test/__mocks__/react-router-dom.tsx), so `MemoryRouter` establishes the
 * location and `useSearchParams`/`__getMockSearch` read it back.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as ReactRouterDom from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Profile from '../Profile';
import { CommandPalette } from '../../components/CommandPalette';

// Stub-only helpers. Cast through `unknown` because the real react-router-dom
// package does not export them; the vitest alias swaps in the stub.
const { __getMockSearch } = ReactRouterDom as unknown as {
  __getMockSearch: () => string;
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('@/hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

vi.mock('../../components/ActivityTimeline', () => ({
  default: () => <div data-testid="mock-activity-timeline">Mock Timeline</div>,
}));

function renderProfile(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Profile />
    </MemoryRouter>,
  );
}

describe('Profile — tab URL state', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  // Runs first: React.lazy caches its resolved module for the whole file, so
  // this is the only test that can observe the Suspense fallback.
  it('shows a role="status" region named "Loading activity" until the panel loads', async () => {
    renderProfile('/profile?tab=activity');

    const loading = screen.getByRole('status', { name: 'Loading activity' });
    expect(loading).toBeInTheDocument();

    await screen.findByText('Profile Activity');
    expect(screen.queryByRole('status', { name: 'Loading activity' })).not.toBeInTheDocument();
  });

  // ── URL drives the selected tab ───────────────────────────────────────────

  it('selects the Activity tab for /profile?tab=activity', () => {
    renderProfile('/profile?tab=activity');

    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('falls back to Overview and rewrites the URL for an unknown ?tab= value', () => {
    renderProfile('/profile?tab=bogus');

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(__getMockSearch()).toBe('?tab=overview');
  });

  it('pushes tab=activity into the URL when the Activity tab is clicked', () => {
    renderProfile('/profile');

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));

    expect(__getMockSearch()).toContain('tab=activity');
  });

  // ── Refresh shortcut scope ────────────────────────────────────────────────

  it('refreshes the feed when R is pressed on the Activity tab', async () => {
    renderProfile('/profile?tab=activity');
    await screen.findByRole('button', { name: /refresh activity feed/i });

    fireEvent.keyDown(document, { key: 'R' });

    expect(screen.getByText('Activity feed refreshed')).toBeInTheDocument();
  });

  it('does not attach the refresh listener on the Overview tab', () => {
    renderProfile('/profile');

    fireEvent.keyDown(document, { key: 'R' });

    expect(screen.queryByText('Activity feed refreshed')).not.toBeInTheDocument();
  });

  it('ignores R while focus is inside an editable field on the Activity tab', async () => {
    render(
      <MemoryRouter initialEntries={['/profile?tab=activity']}>
        <div>
          <input aria-label="note" />
          <Profile />
        </div>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /refresh activity feed/i });

    fireEvent.keyDown(screen.getByLabelText('note'), { key: 'R' });

    expect(screen.queryByText('Activity feed refreshed')).not.toBeInTheDocument();
  });

  // ── Command palette deep link ─────────────────────────────────────────────

  it('offers a "Profile activity" command targeting /profile?tab=activity', async () => {
    render(
      <MemoryRouter>
        <CommandPalette isOpen onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const entry = screen.getByRole('button', { name: /profile activity/i });
    fireEvent.click(entry);

    expect(mockNavigate).toHaveBeenCalledWith('/profile?tab=activity');
  });
});
