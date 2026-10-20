import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip (alias for AccessibleTooltip)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with a label and exposes the tooltip content', () => {
    render(<Tooltip label="This is a helpful hint" />);
    // The trigger with aria-label "More information"
    expect(
      screen.getByLabelText('More information'),
    ).toBeInTheDocument();
    // The tooltip content
    const tooltip = document.getElementById(
      screen.getByLabelText('More information').getAttribute('aria-describedby')!,
    );
    expect(tooltip).toHaveTextContent('This is a helpful hint');
  });

  it('renders children as inline content when provided', () => {
    render(<Tooltip label="Definition">Apr</Tooltip>);
    expect(screen.getByText('Apr')).toBeInTheDocument();
  });

  it('is focusable via keyboard', () => {
    render(<Tooltip label="Extra info" />);
    const trigger = screen.getByLabelText('More information');
    expect(trigger).toHaveAttribute('tabindex', '0');
  });

  test('attaches aria-describedby to the child element, no the wrapper span, once visible', () => {
    render(
      <Tooltip label="Copy link">
        <button>Anchor</button>
      </Tooltip>
    );

    const button = screen.getByRole('button', { name: 'Anchor'});
    const wrapper = button.closest('.tooltip-wrapper')!;
    const tooltip = screen.getByRole('tooltip', { hidden: true});

    //Before showing: neither element is described yet.
    expect(button).not.toHaveAttribute('aria-describedby');
    expect(wrapper).not.toHaveAttribute('aria-describedby');

    fireEvent.focus(wrapper);

    //After showing: the button (focusable child) carries aria-describedby
    //pointing at the tooltip's id - the wrapper span never does.
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
    expect(wrapper).not.toHaveAttribute('aria-describedby');
  });

  test('merges tooltip id into an existing aria-describedby instead of overwriting it', () => {
    render(
        <Tooltip label="Copy link">
          <button aria-describedby='existing-error-id'>Anchor</button>
        </Tooltip>
      );

    const button = screen.getByRole('button', {name: 'Anchor' });
    const wrapper = button.closest('.tooltip-wrapper')!;
    const tooltip = screen.getByRole('tooltip', { hidden: true});

    //before showing: the child's own aria-describedby is untouched.
    expect(button).toHaveAttribute('aria-describedby', 'existing-error-id');

    fireEvent.focus(wrapper);

    //After showing: both ids are present, space-separated, existing one first.
    expect(button).toHaveAttribute(
      'aria-describedby',
      `existing-error-id ${tooltip.id}`
    );
  });

    test('Escape dimisses the tooltip while it is visible', () => {
      render(
        <Tooltip label='Escape test tooltip'>
          <button>Anchor</button>
        </Tooltip>
      );

      const wrapper = screen.getByText('Anchor').closest('.tooltip-wrapper')!;
      fireEvent.focus(wrapper);
      expect(screen.getByRole('tooltip')).toHaveClass('is-visible');

      fireEvent.keyDown(wrapper, { key: 'Escape'});
      expect(screen.getByRole('tooltip', { hidden: true })).not.toHaveClass('is-visible');
    });

    test('Escape does not stop propagation, so a parent listener still fires', () => {
      const parentHandler = vi.fn();

      render(
        <div onKeyDown={parentHandler}>
          <Tooltip label='Escape propagation test'>
            <button>Anchor</button>
          </Tooltip>
        </div>
      );

      const wrapper = screen.getByText('Anchor').closest('.tooltip-wrapper')!;
      fireEvent.focus(wrapper);
      fireEvent.keyDown(wrapper, { key: 'Escape' });

      expect(parentHandler).toHaveBeenCalledTimes(1);
    });
    
    test('touchmove cancels a pending long-press before it fires', () => {
      render(
        <Tooltip label='Touchmove test' longPressDelay={500}>
          <button>Touch me</button>
        </Tooltip>
      );

      const wrapper = screen.getByText('Touch me').closest('.tooltip-wrapper')!;
      fireEvent.touchStart(wrapper);

      //Finger moves before the 500ms therehold - this should cancel the timer.
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.touchMove(wrapper);

      //Even after the original delay would have elapsed, tooltip never shows.
      act(() =>  {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByRole('tooltip', { hidden: true})).not.toHaveClass('is-visible');
    });

    test('touchmove after the tooltip is already visible does not hide it', () => {
      render(
        <Tooltip label='Touchmove no-op test' longPressDelay={500}>
          <button>Touch me</button>
        </Tooltip>
      );

      const wrapper = screen.getByText('Touch me').closest('.tooltip-wrapper')!;
      fireEvent.touchStart(wrapper);

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('tooltip')).toHaveClass('is-visible');

      //Moving after it's already shown is a no-op (clearTimer on a null timer).
      fireEvent.touchMove(wrapper);
      expect(screen.getByRole('tooltip')).toHaveClass('is-visible');
    });
  });
