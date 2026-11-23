import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NotificationCenter } from './NotificationCenter';

describe('NotificationCenter', () => {
  it('renders the heading and KbdHint shortcut', () => {
    render(
      <NotificationCenter>
        <p>No new notifications.</p>
      </NotificationCenter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('Quick open')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <NotificationCenter>
        <p data-testid="child">You have 3 new alerts.</p>
      </NotificationCenter>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('has accessible section label', () => {
    render(
      <NotificationCenter>
        <span>Content</span>
      </NotificationCenter>,
    );
    expect(
      screen.getByRole('region', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });
});
