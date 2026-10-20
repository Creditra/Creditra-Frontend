import { render, screen, act, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CreditLines from '../CreditLines';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPage() {
  const result = render(
    <BrowserRouter>
      <CreditLines defaultLoading={false} />
    </BrowserRouter>
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

describe('CreditLines LiveRegion Announcements', () => {
  it('announces state changes on freeze and unfreeze via aria-live region', () => {
    renderPage();
    
    const liveRegion = document.getElementById('cl-live-region');
    expect(liveRegion).toBeInTheDocument();
    
    // Find the menu for Primary Business Line
    const menuBtn = screen.getByLabelText('Menu for Primary Business Line');
    act(() => {
      fireEvent.click(menuBtn);
    });
    
    // Click Freeze
    const freezeBtn = screen.getByText('Freeze');
    act(() => {
      fireEvent.click(freezeBtn);
    });
    
    expect(liveRegion?.textContent).toBe('Credit line Primary Business Line frozen.');
    
    // Re-open menu
    act(() => {
      fireEvent.click(menuBtn);
    });
    
    // Click Unfreeze
    const unfreezeBtn = screen.getByText('Unfreeze');
    act(() => {
      fireEvent.click(unfreezeBtn);
    });
    
    expect(liveRegion?.textContent).toBe('Credit line Primary Business Line unfrozen.');
  });
});
