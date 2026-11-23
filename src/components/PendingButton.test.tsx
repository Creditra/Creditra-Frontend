import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PendingButton } from './PendingButton';

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
}

describe('PendingButton', () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    setNavigatorOnline(true);
  });

  it('renders enabled when online and requiresOnline is true', () => {
    render(
      <PendingButton
        pending={false}
        pendingLabel="Repaying..."
        requiresOnline
        offlineReason="You're offline — reconnect to repay"
      >
        Confirm Repayment
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveClass('pending-btn--offline');
    expect(btn).not.toHaveAttribute('aria-describedby');
    expect(
      screen.queryByText(/you're offline — reconnect to repay/i),
    ).not.toBeInTheDocument();
  });

  it('disables button with accessible reason when offline and requiresOnline is true', () => {
    setNavigatorOnline(false);

    render(
      <PendingButton
        pending={false}
        pendingLabel="Repaying..."
        requiresOnline
        offlineReason="You're offline — reconnect to repay"
      >
        Confirm Repayment
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /confirm repayment/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveClass('pending-btn--offline');
    expect(btn).toHaveAccessibleDescription("You're offline — reconnect to repay");
  });

  it('re-enables without reload when browser comes back online', () => {
    setNavigatorOnline(false);

    render(
      <PendingButton
        pending={false}
        pendingLabel="Drawing..."
        requiresOnline
        offlineReason="You're offline — reconnect to draw"
      >
        Confirm draw
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /confirm draw/i });
    expect(btn).toBeDisabled();

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(btn).toBeEnabled();
    expect(btn).not.toHaveClass('pending-btn--offline');
    expect(
      screen.queryByText(/you're offline — reconnect to draw/i),
    ).not.toBeInTheDocument();
  });

  it('disables when browser goes offline dynamically', () => {
    setNavigatorOnline(true);

    render(
      <PendingButton
        pending={false}
        pendingLabel="Drawing..."
        requiresOnline
        offlineReason="You're offline — reconnect to draw"
      >
        Confirm draw
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /confirm draw/i });
    expect(btn).toBeEnabled();

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAccessibleDescription("You're offline — reconnect to draw");
  });

  it('leaves buttons without requiresOnline unaffected when offline', () => {
    setNavigatorOnline(false);

    render(
      <PendingButton pending={false} pendingLabel="Signing in...">
        Log in
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /log in/i });
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveClass('pending-btn--offline');
    expect(btn).not.toHaveAttribute('aria-disabled');
    expect(btn).not.toHaveAttribute('aria-describedby');
  });

  it('handles pending and offline at the same time', () => {
    setNavigatorOnline(false);

    render(
      <PendingButton
        pending={true}
        pendingLabel="Processing draw..."
        requiresOnline
        offlineReason="You're offline — reconnect to draw"
      >
        Confirm draw
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /processing draw/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveClass('pending-btn--offline');
    expect(btn.querySelector('.pending-btn__spinner')).toBeInTheDocument();
    expect(btn).toHaveAccessibleDescription("You're offline — reconnect to draw");
  });

  it('falls back to a default reason when offlineReason is omitted or blank', () => {
    setNavigatorOnline(false);

    render(
      <PendingButton pending={false} pendingLabel="Saving..." requiresOnline>
        Save
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription(
      "You're offline — reconnect to continue",
    );
  });

  it('supports explicit isOnline prop override for pure testing', () => {
    setNavigatorOnline(true);

    const { rerender } = render(
      <PendingButton
        pending={false}
        pendingLabel="Submitting..."
        requiresOnline
        isOnline={false}
        offlineReason="You're offline — reconnect to submit"
      >
        Submit
      </PendingButton>,
    );

    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription("You're offline — reconnect to submit");

    rerender(
      <PendingButton
        pending={false}
        pendingLabel="Submitting..."
        requiresOnline
        isOnline={true}
        offlineReason="You're offline — reconnect to submit"
      >
        Submit
      </PendingButton>,
    );

    expect(btn).toBeEnabled();
  });
});
