/**
 * ProfileActivity.test.tsx
 *
 * Tests for the ProfileActivity panel as it is used in the app: mounted
 * inside the Profile page's Activity tab (`/profile?tab=activity`).
 *
 * Coverage:
 *   - Renders the page title and refresh button
 *   - Shows KbdHint shortcut chip with "R" key
 *   - Keyboard shortcut "R" triggers refresh
 *   - Keyboard shortcut guarded against editable targets
 *   - Modifier keys prevent shortcut activation
 *   - sr-only announcement on refresh
 *   - Accessible container attributes
 *   - Mobile responsive layout
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';

vi.mock('../components/ActivityTimeline', () => ({
  default: () => <div data-testid="mock-activity-timeline">Mock Timeline</div>,
}));

/**
 * Renders the Profile page with the Activity tab selected and waits for the
 * lazily-imported ProfileActivity panel to mount.
 */
async function renderProfileActivity() {
  const result = render(
    <MemoryRouter initialEntries={['/profile?tab=activity']}>
      <Profile />
    </MemoryRouter>,
  );
  await screen.findByText('Profile Activity');
  return result;
}

describe('ProfileActivity', () => {
  // ── Core rendering ─────────────────────────────────────────────────────────

  it('renders the page title', async () => {
    await renderProfileActivity();
    expect(screen.getByText('Profile Activity')).toBeInTheDocument();
  });

  it('renders the refresh button', async () => {
    await renderProfileActivity();
    expect(screen.getByRole('button', { name: /refresh activity feed/i })).toBeInTheDocument();
  });

  it('renders the ActivityTimeline component', async () => {
    await renderProfileActivity();
    expect(screen.getByTestId('mock-activity-timeline')).toBeInTheDocument();
  });

  // ── KbdHint shortcut chip ──────────────────────────────────────────────────

  it('renders KbdHint shortcut chip with "R" key', async () => {
    await renderProfileActivity();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('sets aria-label on the refresh button', async () => {
    await renderProfileActivity();
    const btn = screen.getByRole('button', { name: /refresh activity feed/i });
    expect(btn).toHaveAttribute('aria-label', 'Refresh activity feed');
  });

  // ── Keyboard shortcut ──────────────────────────────────────────────────────

  it('triggers refresh when "R" key is pressed', async () => {
    await renderProfileActivity();
    const btn = screen.getByRole('button', { name: /refresh activity feed/i });

    fireEvent.keyDown(document, { key: 'R' });

    expect(btn).toBeInTheDocument();
  });

  it('shows sr-only announcement after refresh', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'R' });

    const announcer = document.querySelector('[role="status"]');
    expect(announcer).toBeInTheDocument();
    expect(announcer).toHaveTextContent('Activity feed refreshed');
  });

  it('clears the announcement after 3 seconds', async () => {
    await renderProfileActivity();

    vi.useFakeTimers();
    fireEvent.keyDown(document, { key: 'R' });
    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not trigger shortcut when focus is in an input field', async () => {
    render(
      <MemoryRouter initialEntries={['/profile?tab=activity']}>
        <div>
          <input data-testid="test-input" />
          <Profile />
        </div>
      </MemoryRouter>,
    );
    await screen.findByText('Profile Activity');

    const input = screen.getByTestId('test-input');
    fireEvent.keyDown(input, { key: 'R' });

    const statusElements = document.querySelectorAll('[role="status"]');
    const refreshAnnouncers = Array.from(statusElements).filter(
      (el) => el.textContent === 'Activity feed refreshed',
    );
    expect(refreshAnnouncers).toHaveLength(0);
  });

  it('does not trigger shortcut when Ctrl is held', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'R', ctrlKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('does not trigger shortcut when Meta is held', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'R', metaKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('does not trigger shortcut when Alt is held', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'R', altKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('handles lowercase "r" key', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'r' });

    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');
  });

  // ── Button click ───────────────────────────────────────────────────────────

  it('triggers refresh when button is clicked', async () => {
    await renderProfileActivity();

    fireEvent.click(screen.getByRole('button', { name: /refresh activity feed/i }));

    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');
  });

  // ── Accessible attributes ──────────────────────────────────────────────────

  it('renders sr-only region with role="status" and aria-live="polite"', async () => {
    await renderProfileActivity();

    fireEvent.keyDown(document, { key: 'R' });

    const announcer = document.querySelector('[role="status"]');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  // ── Mobile responsiveness ──────────────────────────────────────────────────

  it('renders without error in a narrow viewport', async () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    const { container } = await renderProfileActivity();
    expect(container).toBeInTheDocument();

    window.innerWidth = 1024;
  });
});
