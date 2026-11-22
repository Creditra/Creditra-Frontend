import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerHotkey, resetHotkeyRegistry } from '../lib/hotkeys';
import { ShortcutHelpOverlay } from './ShortcutHelpOverlay';

// Isolate component from side-effecting hooks in the JSDOM environment
vi.mock('../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('../hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

const renderOverlay = (props?: Partial<React.ComponentProps<typeof ShortcutHelpOverlay>>) =>
  render(
    <MemoryRouter>
      <ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe('ShortcutHelpOverlay', () => {
  beforeEach(() => {
    resetHotkeyRegistry();
  });

  afterEach(() => {
    resetHotkeyRegistry();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MemoryRouter>
        <ShortcutHelpOverlay isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders registered shortcut groups by scope', () => {
    registerHotkey({
      combo: '?',
      scope: 'global',
      description: 'Open this keyboard shortcut guide',
      handler: vi.fn(),
    });
    registerHotkey({
      combo: 'R',
      scope: 'page',
      description: 'Refresh the activity feed',
      handler: vi.fn(),
    });
    registerHotkey({
      combo: 'Shift+R',
      scope: 'modal',
      description: 'Mark all notifications as read',
      handler: vi.fn(),
    });

    renderOverlay();
    expect(screen.getByRole('heading', { name: 'Global' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modal' })).toBeInTheDocument();
    expect(screen.getByText('Open this keyboard shortcut guide')).toBeInTheDocument();
    expect(screen.getByText('Refresh the activity feed')).toBeInTheDocument();
    expect(screen.getByText('Mark all notifications as read')).toBeInTheDocument();
  });

  it('lists only scopes that have registered shortcuts', () => {
    registerHotkey({
      combo: '?',
      scope: 'global',
      description: 'Open this keyboard shortcut guide',
      handler: vi.fn(),
    });

    renderOverlay();
    expect(screen.getByRole('heading', { name: 'Global' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modal' })).not.toBeInTheDocument();
  });

  it('renders the settings link pointing to /help#shortcuts', () => {
    renderOverlay();
    expect(
      screen.getByRole('link', { name: /settings and shortcut notes/i }),
    ).toHaveAttribute('href', '/help#shortcuts');
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it('has role="dialog" with aria-modal and accessible name', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'shortcut-help-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'shortcut-help-desc');
  });

  it('close button has a descriptive aria-label', () => {
    renderOverlay();
    expect(
      screen.getByRole('button', { name: /close keyboard shortcut help/i }),
    ).toBeInTheDocument();
  });

  it('moves focus to the close button on open', async () => {
    renderOverlay();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /close keyboard shortcut help/i }),
      ).toHaveFocus();
    });
  });

  // ── Interactions ───────────────────────────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close keyboard shortcut help/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    // The backdrop has aria-hidden so we query by CSS class
    const backdrop = document.querySelector('.shortcut-help-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the settings link is clicked', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByRole('link', { name: /settings and shortcut notes/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
