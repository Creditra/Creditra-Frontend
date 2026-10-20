import { render, screen, fireEvent, act } from '@testing-library/react';
import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest';
import { OnboardingFlow } from './OnboardingFlow';

// Provide a clean requestAnimationFrame polyfill (jsdom doesn't ship one)
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 16) as unknown as number;
}

// Mock framer-motion so tests run without a real browser environment
const mockUseReducedMotion = vi.hoisted(() => vi.fn(() => false));

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
    AnimatePresence({ children, mode: _mode }: any) {
      return createElement(Fragment, null, children);
    },
    useReducedMotion(...args: any[]) {
      return mockUseReducedMotion(...args);
    },
  };
});

describe('OnboardingFlow', () => {
  const defaultProps = {
    isOpen: true,
    onComplete: vi.fn(),
    onSkip: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test('returns null when isOpen is false', () => {
    const { container } = render(
      <OnboardingFlow {...defaultProps} isOpen={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the first step by default', () => {
    render(<OnboardingFlow {...defaultProps} />);
    expect(screen.getByText('Welcome to Creditra')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  test('navigates to the next step on Next click', () => {
    render(<OnboardingFlow {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Credit Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  test('navigates back on Back click', () => {
    render(<OnboardingFlow {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByText('Welcome to Creditra')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  test('back button is disabled on the first step', () => {
    render(<OnboardingFlow {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled();
  });

  test('calls onComplete and persists localStorage on the last step', () => {
    const onComplete = vi.fn();
    render(<OnboardingFlow {...defaultProps} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('onboarding_completed')).toBe('true');
  });

  test('calls onSkip and persists localStorage when skip is clicked', () => {
    const onSkip = vi.fn();
    render(<OnboardingFlow {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip onboarding' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('onboarding_completed')).toBe('true');
  });

  test('renders step indicators for each step', () => {
    render(<OnboardingFlow {...defaultProps} />);
    const indicators = screen.getAllByRole('listitem');
    expect(indicators).toHaveLength(3);
  });

  test('shows Get Started label on the last step', () => {
    render(<OnboardingFlow {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(
      screen.getByRole('button', { name: 'Get started' }),
    ).toBeInTheDocument();
  });

  describe('Tooltip primitives on OnboardingFlow', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('renders tooltip on hover over skip button', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const skipBtn = screen.getByRole('button', { name: 'Skip onboarding' });
      const wrapper = skipBtn.closest('.tooltip-wrapper')!;

      fireEvent.mouseEnter(wrapper);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByText('Skip onboarding flow')).toBeInTheDocument();
    });

    test('renders tooltip on step indicator hover', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const indicatorBtn = screen.getByRole('button', { name: 'Step 1' });
      const wrapper = indicatorBtn.closest('.tooltip-wrapper')!;

      fireEvent.mouseEnter(wrapper);
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(screen.getByText('Step 1: Welcome to Creditra')).toBeInTheDocument();
    });

    test('allows clicking step indicator to jump steps', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const step3Indicator = screen.getByRole('button', { name: 'Step 3' });
      fireEvent.click(step3Indicator);
      expect(screen.getByText('Flexible Credit Lines')).toBeInTheDocument();
    });
  });

  describe('keyboard focus (WCAG 2.1 AA — FWC26)', () => {
    test('skip button is focusable', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const skipBtn = screen.getByRole('button', { name: 'Skip onboarding' });
      skipBtn.focus();
      expect(document.activeElement).toBe(skipBtn);
    });

    test('next step button is focusable', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const nextBtn = screen.getByRole('button', { name: 'Next step' });
      nextBtn.focus();
      expect(document.activeElement).toBe(nextBtn);
    });

    test('step indicator buttons are focusable', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const indicators = screen.getAllByRole('button', { name: /^Step \d+$/ });
      expect(indicators).toHaveLength(3);
      indicators[0].focus();
      expect(document.activeElement).toBe(indicators[0]);
    });

    test('all interactive elements are keyboard-reachable (skip, 3 indicators, back, next)', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const interactive = screen.getAllByRole('button');
      // 1 skip + 3 indicators + 1 back + 1 next = 6 buttons on step 1
      expect(interactive).toHaveLength(6);
      // All non-disabled buttons should accept programmatic focus
      interactive.forEach((btn) => {
        if (!(btn as HTMLButtonElement).disabled) {
          btn.focus();
          expect(document.activeElement).toBe(btn);
        }
      });
    });

    test('back button is disabled when on first step', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const backBtn = screen.getByRole('button', { name: 'Go back' });
      expect(backBtn).toBeDisabled();
    });

    test('skip button stays focusable across all steps', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const skipBtn = screen.getByRole('button', { name: 'Skip onboarding' });
      skipBtn.focus();
      expect(document.activeElement).toBe(skipBtn);

      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
      skipBtn.focus();
      expect(document.activeElement).toBe(skipBtn);

      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
      skipBtn.focus();
      expect(document.activeElement).toBe(skipBtn);
    });

    test('all interactive elements have type="button" (prevents form submission)', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('type', 'button');
      });
    });

    test('step indicator buttons have aria-current for active step', () => {
      render(<OnboardingFlow {...defaultProps} />);
      const step1 = screen.getByRole('button', { name: 'Step 1' });
      expect(step1).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('reduced-motion', () => {
    test('renders all steps and supports navigation when reduced motion is active', () => {
      mockUseReducedMotion.mockReturnValue(true);
      render(<OnboardingFlow {...defaultProps} />);

      // First step renders
      expect(screen.getByText('Welcome to Creditra')).toBeInTheDocument();

      // Navigate forward
      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
      expect(screen.getByText('Credit Evaluation')).toBeInTheDocument();

      // Navigate backward
      fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
      expect(screen.getByText('Welcome to Creditra')).toBeInTheDocument();

      // Complete the flow
      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
      fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    test('supports skip when reduced motion is active', () => {
      mockUseReducedMotion.mockReturnValue(true);
      const onSkip = vi.fn();
      render(<OnboardingFlow {...defaultProps} onSkip={onSkip} />);

      fireEvent.click(screen.getByRole('button', { name: 'Skip onboarding' }));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });
});
