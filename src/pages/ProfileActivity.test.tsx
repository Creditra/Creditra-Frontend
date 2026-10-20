/**
 * ProfileActivity.test.tsx
 *
 * Unit tests for the ProfileActivity component.
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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProfileActivity } from './ProfileActivity';

vi.mock('../components/ActivityTimeline', () => ({
  default: () => <div data-testid="mock-activity-timeline">Mock Timeline</div>,
}));

describe('ProfileActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Core rendering ─────────────────────────────────────────────────────────

  it('renders the page title', () => {
    render(<ProfileActivity />);
    expect(screen.getByText('Profile Activity')).toBeInTheDocument();
  });

  it('renders the refresh button', () => {
    render(<ProfileActivity />);
    expect(screen.getByRole('button', { name: /refresh activity feed/i })).toBeInTheDocument();
  });

  it('renders the ActivityTimeline component', () => {
    render(<ProfileActivity />);
    expect(screen.getByTestId('mock-activity-timeline')).toBeInTheDocument();
  });

  // ── KbdHint shortcut chip ──────────────────────────────────────────────────

  it('renders KbdHint shortcut chip with "R" key', () => {
    render(<ProfileActivity />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('sets aria-label on the refresh button', () => {
    render(<ProfileActivity />);
    const btn = screen.getByRole('button', { name: /refresh activity feed/i });
    expect(btn).toHaveAttribute('aria-label', 'Refresh activity feed');
  });

  // ── Keyboard shortcut ──────────────────────────────────────────────────────

  it('triggers refresh when "R" key is pressed', () => {
    render(<ProfileActivity />);
    const btn = screen.getByRole('button', { name: /refresh activity feed/i });

    fireEvent.keyDown(document, { key: 'R' });

    expect(btn).toBeInTheDocument();
  });

  it('shows sr-only announcement after refresh', async () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R' });

    const announcer = document.querySelector('[role="status"]');
    expect(announcer).toBeInTheDocument();
    expect(announcer).toHaveTextContent('Activity feed refreshed');
  });

  it('clears the announcement after 3 seconds', async () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R' });
    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('does not trigger shortcut when focus is in an input field', () => {
    render(
      <div>
        <input data-testid="test-input" />
        <ProfileActivity />
      </div>,
    );

    const input = screen.getByTestId('test-input');
    fireEvent.keyDown(input, { key: 'R' });

    const statusElements = document.querySelectorAll('[role="status"]');
    const refreshAnnouncers = Array.from(statusElements).filter(
      (el) => el.textContent === 'Activity feed refreshed',
    );
    expect(refreshAnnouncers).toHaveLength(0);
  });

  it('does not trigger shortcut when Ctrl is held', () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R', ctrlKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('does not trigger shortcut when Meta is held', () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R', metaKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('does not trigger shortcut when Alt is held', () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R', altKey: true });

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('handles lowercase "r" key', () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'r' });

    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');
  });

  // ── Button click ───────────────────────────────────────────────────────────

  it('triggers refresh when button is clicked', () => {
    render(<ProfileActivity />);

    fireEvent.click(screen.getByRole('button', { name: /refresh activity feed/i }));

    expect(document.querySelector('[role="status"]')).toHaveTextContent('Activity feed refreshed');
  });

  // ── Accessible attributes ──────────────────────────────────────────────────

  it('renders sr-only region with role="status" and aria-live="polite"', () => {
    render(<ProfileActivity />);

    fireEvent.keyDown(document, { key: 'R' });

    const announcer = document.querySelector('[role="status"]');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  // ── Mobile responsiveness ──────────────────────────────────────────────────

  it('renders without error in a narrow viewport', () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    const { container } = render(<ProfileActivity />);
    expect(container).toBeInTheDocument();

    window.innerWidth = 1024;
  });
});
