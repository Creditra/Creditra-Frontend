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
      vi.advanceTimesByTime(100);
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

  it('restores focus to the previously focused element when still connected', () => {
    const prev = document.createElement('button');
    prev.id = 'prev';
    document.body.appendChild(prev);
    prev.focus();

    const { unmount } = render(
      <TrapHarness isActive={true} onEscape={vi.fn()} />
    );

    unmount();

    expect(document.activeElement).toBe(prev);
  });

  it('falls back to triggerRef when previous element is detached', () => {
    const prev = document.createElement('button');
    prev.id = 'prev';
    document.body.appendChild(prev);
    prev.focus();

    const triggerRef = { current: trigger };
    const { unmount } = render(
      <TrapHarness isActive={true} onEscape={vi.fn()} triggerRef={triggerRef} />
    );

    // Detach the previously focused element while the trap is active.
    prev.remove();

    unmount();

    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to the main landmark when previous and trigger are detached', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);

    const prev = document.createElement('button');
    document.body.appendChild(prev);
    prev.focus();

    const triggerRef = { current: trigger };
    const { unmount } = render(
      <TrapHarness isActive={true} onEscape={vi.fn()} triggerRef={triggerRef} />
    );

    prev.remove();
    trigger.remove();

    unmount();

    expect(document.activeElement).toBe(main);
  });
});
