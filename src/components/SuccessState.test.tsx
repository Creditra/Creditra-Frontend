import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SuccessState from './SuccessState';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('SuccessState', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('navigates to /transactions without changing window.location.hash when default View Transaction History button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/draw']}>
        <Routes>
          <Route
            path="/draw"
            element={<SuccessState type="draw" onClose={vi.fn()} />}
          />
          <Route path="/transactions" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Transaction History' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/transactions');
    expect(window.location.hash).toBe('');
  });

  it('calls custom onViewHistory instead of navigating to /transactions', () => {
    const onViewHistory = vi.fn();

    render(
      <MemoryRouter initialEntries={['/repay']}>
        <Routes>
          <Route
            path="/repay"
            element={
              <SuccessState
                type="repay"
                onClose={vi.fn()}
                onViewHistory={onViewHistory}
              />
            }
          />
          <Route path="/transactions" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'View Transaction History' }));

    expect(onViewHistory).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('location-probe')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('does not render View Transaction History button for evaluation type', () => {
    render(
      <MemoryRouter initialEntries={['/evaluate']}>
        <SuccessState type="evaluation" onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(
      screen.queryByRole('button', { name: 'View Transaction History' })
    ).not.toBeInTheDocument();
  });
});
