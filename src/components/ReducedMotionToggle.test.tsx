import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReducedMotionToggle } from './ReducedMotionToggle';

/**
 * The component only consumes `motionOverride` and `toggleMotionOverride` from
 * the reduced-motion context, so the context is stubbed here (the same approach
 * used in RepayPage.test.tsx) instead of rendering the provider and its
 * localStorage/matchMedia side effects.
 */
const { reducedMotionContext } = vi.hoisted(() => ({
  reducedMotionContext: {
    motionOverride: 'system' as 'system' | 'reduced',
    toggleMotionOverride: vi.fn(),
  },
}));

vi.mock('../context/ReducedMotionContext', () => ({
  useReducedMotion: () => reducedMotionContext,
}));

beforeEach(() => {
  reducedMotionContext.motionOverride = 'system';
  reducedMotionContext.toggleMotionOverride.mockClear();
});

describe('ReducedMotionToggle', () => {
  it('renders the off state when the override is "system"', () => {
    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('data-state', 'off');
    expect(toggle).toHaveTextContent('Off');
    expect(toggle).not.toHaveTextContent('On');
  });

  it('renders the on state when the override is "reduced"', () => {
    reducedMotionContext.motionOverride = 'reduced';

    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAttribute('data-state', 'on');
    expect(toggle).toHaveTextContent('On');
    expect(toggle).not.toHaveTextContent('Off');
  });

  it('calls toggleMotionOverride once when clicked', async () => {
    const user = userEvent.setup();
    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(reducedMotionContext.toggleMotionOverride).toHaveBeenCalledTimes(1);
  });

  it('activates the focused switch with the Space key', async () => {
    const user = userEvent.setup();
    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard(' ');

    expect(reducedMotionContext.toggleMotionOverride).toHaveBeenCalledTimes(1);
  });

  it('activates the focused switch with the Enter key', async () => {
    const user = userEvent.setup();
    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(reducedMotionContext.toggleMotionOverride).toHaveBeenCalledTimes(1);
  });

  it('labels and describes the switch by existing elements in the default layout', () => {
    render(<ReducedMotionToggle />);

    const toggle = screen.getByRole('switch');

    const labelId = toggle.getAttribute('aria-labelledby');
    const descriptionId = toggle.getAttribute('aria-describedby');
    expect(labelId).toBe('rm-toggle-label');
    expect(descriptionId).toBe('rm-toggle-desc');

    const label = document.getElementById(labelId as string);
    const description = document.getElementById(descriptionId as string);
    expect(label).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(label).toHaveTextContent('Reduced Motion Preview');
    expect(description).toHaveTextContent(/Forces a reduced-motion state/i);
  });

  it('uses only an aria-label and no visible label group in the compact layout', () => {
    render(<ReducedMotionToggle compact />);

    const toggle = screen.getByRole('switch');

    expect(toggle).toHaveAttribute('aria-label', 'Toggle reduced motion preview');
    expect(toggle).not.toHaveAttribute('aria-labelledby');
    expect(toggle).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('rm-toggle-label')).toBeNull();
    expect(document.getElementById('rm-toggle-desc')).toBeNull();
    expect(screen.queryByText('Reduced Motion Preview')).not.toBeInTheDocument();
  });
});
