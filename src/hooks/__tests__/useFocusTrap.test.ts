import { renderHook } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';
import { useRef } from 'react';

describe('useFocusTrap', () => {
  let container: HTMLDivElement;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    // Setup DOM
    container = document.createElement('div');
    container.innerHTML = `
      <button id="first">First</button>
      <button id="second">Second</button>
      <a href="#" id="third">Third</a>
      <input id="fourth" />
    `;
    document.body.appendChild(container);

    trigger = document.createElement('button');
    trigger.id = 'trigger';
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses first element when activated', () => {
    const triggerRef = { current: trigger };
    
    renderHook(() =>
      useFocusTrap({
        isActive: true,
        triggerRef,
        onEscape: jest.fn(),
      })
    );

    // Wait for setTimeout
    jest.advanceTimersByTime(100);

    expect(document.activeElement).toBe(container.querySelector('#first'));
  });

  it('traps Tab key forward', () => {
    const onEscape = jest.fn();
    const triggerRef = { current: trigger };

    renderHook(() =>
      useFocusTrap({
        isActive: true,
        triggerRef,
        onEscape,
      })
    );

    const first = container.querySelector('#first') as HTMLElement;
    const last = container.querySelector('#fourth') as HTMLElement;

    last.focus();

    // Simulate Tab on last element
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(tabEvent);

    expect(document.activeElement).toBe(first);
  });

  it('traps Shift+Tab backward', () => {
    const onEscape = jest.fn();
    const triggerRef = { current: trigger };

    renderHook(() =>
      useFocusTrap({
        isActive: true,
        triggerRef,
        onEscape,
      })
    );

    const first = container.querySelector('#first') as HTMLElement;
    const last = container.querySelector('#fourth') as HTMLElement;

    first.focus();

    // Simulate Shift+Tab on first element
    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
    });
    document.dispatchEvent(shiftTabEvent);

    expect(document.activeElement).toBe(last);
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = jest.fn();
    const triggerRef = { current: trigger };

    renderHook(() =>
      useFocusTrap({
        isActive: true,
        triggerRef,
        onEscape,
      })
    );

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('returns focus to trigger on cleanup', () => {
    const onEscape = jest.fn();
    const triggerRef = { current: trigger };

    const { unmount } = renderHook(() =>
      useFocusTrap({
        isActive: true,
        triggerRef,
        onEscape,
      })
    );

    unmount();

    expect(document.activeElement).toBe(trigger);
  });
});