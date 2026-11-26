import { render, screen, fireEvent } from '@testing-library/react';
import { CreditLineRowMenu } from '../CreditLineRowMenu';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

describe('CreditLineRowMenu', () => {
  const defaultProps = {
    lineId: 'line-123',
    lineName: 'Test Credit Line',
    onRepay: vi.fn(),
    onSchedule: vi.fn(),
    onDetails: vi.fn(),
  };

  test('renders the menu button', () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/Menu for Test Credit Line/i)).toBeInTheDocument();
  });

  test('opens the menu when the button is clicked', () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    const button = screen.getByLabelText(/Menu for Test Credit Line/i);
    fireEvent.click(button);

    expect(screen.getByRole('menuitem', { name: /Repay/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Draw/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Details/i })).toBeInTheDocument();
  });

  test('closes the menu when clicking outside', async () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    const button = screen.getByLabelText(/Menu for Test Credit Line/i);
    fireEvent.click(button);
    expect(screen.getByRole('menuitem', { name: /Repay/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    
    // Use a small delay to allow the effect to run
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('menuitem', { name: /Repay/i })).not.toBeInTheDocument();
  });

  test('calls onRepay when Repay is clicked', () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /Repay/i }));

    expect(defaultProps.onRepay).toHaveBeenCalledTimes(1);
  });

  test('calls onSchedule when Schedule is clicked', () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /Schedule/i }));

    expect(defaultProps.onSchedule).toHaveBeenCalledWith('line-123');
  });

  test('calls onDetails when Details is clicked', () => {
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /Details/i }));

    expect(defaultProps.onDetails).toHaveBeenCalledWith('line-123');
  });

  test('renders and calls onAdjustCollateral when Adjust Collateral is clicked', () => {
    const onAdjustCollateral = vi.fn();
    render(
      <MemoryRouter>
        <CreditLineRowMenu {...defaultProps} onAdjustCollateral={onAdjustCollateral} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));
    const item = screen.getByRole('menuitem', { name: /Adjust Collateral/i });
    expect(item).toBeInTheDocument();

    fireEvent.click(item);
    expect(onAdjustCollateral).toHaveBeenCalledWith('line-123');
  });

  test('exposes limit increase eligibility reasons accessibly', () => {
    const onRequestLimitIncrease = vi.fn();
    const reasons = ['Risk score must be at least 650.'];
    render(
      <MemoryRouter>
        <CreditLineRowMenu
          {...defaultProps}
          onRequestLimitIncrease={onRequestLimitIncrease}
          limitIncreaseDisabledReasons={reasons}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));

    const action = screen.getByRole('menuitem', { name: /Request limit increase/i });
    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription(reasons[0]);
    expect(onRequestLimitIncrease).not.toHaveBeenCalled();
  });

  test('invokes an eligible limit increase action', () => {
    const onRequestLimitIncrease = vi.fn();
    render(
      <MemoryRouter>
        <CreditLineRowMenu
          {...defaultProps}
          onRequestLimitIncrease={onRequestLimitIncrease}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText(/Menu for Test Credit Line/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /Request limit increase/i }));
    expect(onRequestLimitIncrease).toHaveBeenCalledWith('line-123');
  });
});
