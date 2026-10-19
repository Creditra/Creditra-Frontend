import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useFocusTrap } from '../useFocusTrap';

/**
 * Test harness: renders a focusable container wired to useFocusTrap.
 * The hook returns a containerRef that must be attached to the DOM node
 * that owns the focusable children.
 */
function TrapHarness({
  isActive,
  onEscape,
  triggerRef,
}: {
  isActive: boolean;
  onEscape?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useFocusTrap({ isActive, triggerRef, onEscape });
  return (
    <div ref={containerRef} data-testid="container">
      <button id="first">First</button>
      <button id="second">Second</button>
      <a href="#" id="third">Third</a>
      <input id="fourth" />
    </div>
  );
}

describe('useFocusTrap', () => {
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    trigger = document.createElement('button');
    trigger.id = 'trigger';
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('focuses first element when activated', () => {
    render(<TrapHarness isActive={true} onEscape={vi.fn()} />);
    const first = document.getElementById('first') as HTMLElement;

    // Advance past the setTimeout(50ms) used to defer focus
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(first);
  });

  it('traps Tab key forward', () => {
    render(<TrapHarness isActive={true} onEscape={vi.fn()} />);
    const first = document.getElementById('first') as HTMLElement;
    const last = document.getElementById('fourth') as HTMLElement;

    last.focus();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
    });

    expect(document.activeElement).toBe(first);
  });

  it('traps Shift+Tab backward', () => {
    render(<TrapHarness isActive={true} onEscape={vi.fn()} />);
    const first = document.getElementById('first') as HTMLElement;
    const last = document.getElementById('fourth') as HTMLElement;

    first.focus();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      );
    });

    expect(document.activeElement).toBe(last);
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    render(<TrapHarness isActive={true} onEscape={onEscape} />);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('returns focus to trigger on cleanup', () => {
    const triggerRef = { current: trigger };

    const { unmount } = render(
      <TrapHarness isActive={true} onEscape={vi.fn()} triggerRef={triggerRef} />
    );

    unmount();

    expect(document.activeElement).toBe(trigger);
  });

  it('does not move focus when re-rendered with a new inline onEscape while active', () => {
    const { rerender } = render(<TrapHarness isActive={true} onEscape={() => {}} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const second = document.getElementById('second') as HTMLElement;
    second.focus();
    expect(document.activeElement).toBe(second);

    rerender(<TrapHarness isActive={true} onEscape={() => {}} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(second);
  });

  it('calls the latest onEscape once when Escape is pressed after several re-renders', () => {
    const firstEscape = vi.fn();
    const secondEscape = vi.fn();
    const latestEscape = vi.fn();

    const { rerender } = render(<TrapHarness isActive={true} onEscape={firstEscape} />);
    rerender(<TrapHarness isActive={true} onEscape={secondEscape} />);
    rerender(<TrapHarness isActive={true} onEscape={latestEscape} />);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(firstEscape).not.toHaveBeenCalled();
    expect(secondEscape).not.toHaveBeenCalled();
    expect(latestEscape).toHaveBeenCalledTimes(1);
  });

  it('clears the initial-focus timer when unmounted within 50 ms of activation', () => {
    const { unmount } = render(<TrapHarness isActive={true} onEscape={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(20);
    });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});