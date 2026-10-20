import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DefaultRiskModal } from './DefaultRiskModal';

// Mock framer-motion so tests execute reliably in jsdom without pending transition timers
vi.mock('framer-motion', async () => {
  const { createElement, Fragment, forwardRef } = await import('react');
  return {
    motion: {
      div: forwardRef(function MotionDiv(
        { children, initial, animate, exit, transition, ...props }: any,
        ref: any,
      ) {
        return createElement('div', { ...props, ref }, children);
      }),
    },
    AnimatePresence({ children }: any) {
      return createElement(Fragment, null, children);
    },
  };
});

describe('DefaultRiskModal', () => {
  const onAcknowledgeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  it('renders when isOpen is true', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('What is a Default?')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<DefaultRiskModal isOpen={false} onAcknowledge={onAcknowledgeMock} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has the Back button disabled on step 1', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeDisabled();
    expect(backBtn).toHaveAttribute('aria-disabled', 'true');
    expect(backBtn).toHaveAttribute('tabindex', '-1');
  });

  it('advances from step 1 -> step 2 -> step 3 on clicking Next', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Step 1
    expect(screen.getByText('What is a Default?')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /^next$/i });

    // Step 1 -> Step 2
    fireEvent.click(nextBtn);
    expect(screen.getByText('Consequences of Default')).toBeInTheDocument();
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).not.toBeDisabled();

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('How to Avoid Default')).toBeInTheDocument();
  });

  it('navigates back to step 1 from step 2 when clicking Back', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText('Consequences of Default')).toBeInTheDocument();

    // Click back
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('What is a Default?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('shows the "I Understand" confirmation button only on step 3', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Step 1: should not have "I Understand"
    expect(screen.queryByRole('button', { name: /i understand/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();

    // Step 2: should not have "I Understand"
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.queryByRole('button', { name: /i understand/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();

    // Step 3: Next button replaced with "I Understand"
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('button', { name: /i understand/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('calls onAcknowledge when "I Understand" button is clicked on step 3', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Advance to step 3
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    const confirmBtn = screen.getByRole('button', { name: /i understand/i });
    fireEvent.click(confirmBtn);

    expect(onAcknowledgeMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onAcknowledge and does not close on Escape key press', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onAcknowledgeMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not call onAcknowledge when backdrop is clicked', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    const overlay = document.getElementById('default-risk-modal');
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(onAcknowledgeMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sets aria-current="step" on the active step indicator', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Step 1 active
    const indicators = screen.getAllByRole('listitem');
    expect(indicators).toHaveLength(3);
    expect(indicators[0]).toHaveAttribute('aria-current', 'step');
    expect(indicators[1]).not.toHaveAttribute('aria-current');
    expect(indicators[2]).not.toHaveAttribute('aria-current');

    // Step 2 active
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(indicators[0]).not.toHaveAttribute('aria-current');
    expect(indicators[1]).toHaveAttribute('aria-current', 'step');
    expect(indicators[2]).not.toHaveAttribute('aria-current');

    // Step 3 active
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(indicators[0]).not.toHaveAttribute('aria-current');
    expect(indicators[1]).not.toHaveAttribute('aria-current');
    expect(indicators[2]).toHaveAttribute('aria-current', 'step');
  });

  describe('focus management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ensures keyboard focus is placed inside the modal when open', () => {
      render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const dialog = screen.getByRole('dialog');
      const activeEl = document.activeElement;
      expect(dialog.contains(activeEl) || dialog === activeEl).toBe(true);
    });

    it('restores focus to the trigger when closed via Escape', () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Learn about default risk';
      document.body.appendChild(trigger);
      trigger.focus();
      const triggerRef = { current: trigger };

      const onClose = vi.fn();
      const { unmount } = render(
        <DefaultRiskModal
          isOpen={true}
          onAcknowledge={onAcknowledgeMock}
          triggerRef={triggerRef}
          onClose={onClose}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Simulate the parent closing the modal after Escape.
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(onClose).toHaveBeenCalled();

      act(() => {
        unmount();
      });

      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });
  });
});