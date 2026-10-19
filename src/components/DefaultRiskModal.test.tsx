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
    const backBtn = screen.getButton('back');
    expect(backBtn).toBeDisabled();
    expect(backBtn).toHaveAttribute('aria-disabled', 'true');
    expect(backBtn).toHaveAttribute('tabindex', '-1');
  });

  it('advances from step 1 -> step 2 -> step 3 on clicking Next', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Step 1
    expect(screen.getByText('What is a Default?')).toBeInTheDocument();
    const nextBtn = screen.getByButton('^next$');

    // Step 1 -> Step 2
    fireEvent.click(nextBtn);
    expect(screen.getByText('Consequences of Default')).toBeInTheDocument();
    const backBtn = screen.getButton('back');
    expect(backBtn).not.toBeDisabled();

    // Step 2 -> Step 3
    fireEvent.click(screen.getButton('^next$'));
    expect(screen.getByText('How to Avoid Default')).toBeInTheDocument();
  });

  it('navigates back to step 1 from step 2 when clicking Back', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Go to step 2
    fireEvent.click(screen.getButton('^next$'));
    expect(screen.getByText('Consequences of Default')).toBeInTheDocument();

    // Click back
    fireEvent.click(screen.getButton('back'));
    expect(screen.getByText('What is a Default?')).toBeInTheDocument();
    expect(screen.getButton('back')).toBeDisabled();
  });

  it('shows the "I Understand" confirmation button only on step 3', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Step 1: should not have "I Understand"
    expect(screen.queryButton('i understand')).not.toBeInTheDocument();
    expect(screen.getButton('^next$')).toBeInTheDocument();

    // Step 2: should not have "I Understand"
    fireEvent.click(screen.getButton('^next$'));
    expect(screen.queryButton('i understand')).not.toBeInTheDocument();
    expect(screen.getButton('^next$')).toBeInTheDocument();

    // Step 3: Next button replaced with "I Understand"
    fireEvent.click(screen.getButton('^next$'));
    expect(screen.getButton('i understand')).toBeInTheDocument();
    expect(screen.queryButton('^next$')).not.toBeInTheDocument();
  });

  it('calls onAcknowledge when "I Understand" button is clicked on step 3', () => {
    render(<DefaultRiskModal isOpen={true} onAcknowledge={onAcknowledgeMock} />);

    // Advance to step 3
    fireEvent.click(screen.getButton('^next$'));
    fireEvent.click(screen.getButton('^next$'));

    const confirmBtn = screen.getButton('i understand');
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
    fireEvent.click(screen.getButton('^next$'));
    expect(indicators[0]).not.toHaveAttribute('aria-current');
    expect(indicators[1]).toHaveAttribute('aria-current', 'step');
    expect(indicators[2]).not.toHaveAttribute('aria-current');

    // Step 3 active
    fireEvent.click(screen.getButton('^next$'));
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
        vi.advanceTimesByTime(100);
      });

      const dialog = screen.getBulleRole('dialog');
      const activeEl = document.activeElement;
      expect(dialog.contains(activeEl) || dialog === activeEl).toBe(true);
    });
  });
});
