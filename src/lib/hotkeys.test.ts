import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  registerHotkey,
  useHotkey,
  getRegisteredHotkeys,
  formatComboKeys,
  parseCombo,
  resetHotkeyRegistry,
  type HotkeySpec,
} from './hotkeys';

beforeEach(() => {
  resetHotkeyRegistry();
});

afterEach(() => {
  resetHotkeyRegistry();
  vi.restoreAllMocks();
});

describe('hotkeys registry', () => {
  it('parses and formats key combos', () => {
    expect(parseCombo('Mod+K')).toMatchObject({ mod: true, key: 'k', normalized: 'mod+k' });
    expect(parseCombo('Shift+R')).toMatchObject({ shift: true, key: 'r', normalized: 'shift+r' });
    expect(parseCombo('?')).toMatchObject({ key: '?', isPunctuation: true, normalized: '?' });

    expect(formatComboKeys('Mod+K')).toEqual(['Ctrl/⌘', 'K']);
    expect(formatComboKeys('Shift+R')).toEqual(['Shift', 'R']);
    expect(formatComboKeys('ArrowLeft')).toEqual(['←']);
    expect(formatComboKeys('ArrowRight')).toEqual(['→']);
    expect(formatComboKeys('Escape')).toEqual(['Esc']);
    expect(formatComboKeys('?')).toEqual(['?']);
  });

  it('attaches a single document listener for multiple bubble bindings and removes it on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const unsub1 = registerHotkey({
      combo: 'R',
      scope: 'page',
      description: 'Refresh',
      handler: vi.fn(),
    });
    const unsub2 = registerHotkey({
      combo: '?',
      scope: 'global',
      description: 'Help',
      handler: vi.fn(),
    });

    const keydownAdds = addSpy.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(1);

    unsub1();
    expect(removeSpy.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0);

    unsub2();
    expect(removeSpy.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    expect(getRegisteredHotkeys()).toHaveLength(0);
  });

  it('matches modifiers accurately (Mod, Shift, plain keys)', () => {
    const modHandler = vi.fn();
    const shiftHandler = vi.fn();
    const plainHandler = vi.fn();

    registerHotkey({ combo: 'Mod+K', scope: 'global', description: 'Palette', handler: modHandler });
    registerHotkey({ combo: 'Shift+R', scope: 'modal', description: 'Mark read', handler: shiftHandler });
    registerHotkey({ combo: 'R', scope: 'page', description: 'Refresh', handler: plainHandler });

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(modHandler).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: 'R', shiftKey: true });
    expect(shiftHandler).toHaveBeenCalledTimes(1);
    expect(plainHandler).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'r' });
    expect(plainHandler).toHaveBeenCalledTimes(1);
    expect(shiftHandler).toHaveBeenCalledTimes(1);
  });

  it('guards editable targets by default and respects allowInEditable', () => {
    const guarded = vi.fn();
    const allowed = vi.fn();

    registerHotkey({ combo: '?', scope: 'global', description: 'Help', handler: guarded });
    registerHotkey({
      combo: 'Mod+K',
      scope: 'global',
      description: 'Palette',
      allowInEditable: true,
      handler: allowed,
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: '?' });
    expect(guarded).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(allowed).toHaveBeenCalledTimes(1);

    input.remove();
  });

  it('runs capture-phase bindings before bubble-phase bindings and respects preventDefault', () => {
    const order: string[] = [];

    registerHotkey({
      combo: '?',
      scope: 'global',
      description: 'Global help',
      handler: () => order.push('bubble'),
    });
    registerHotkey({
      combo: '?',
      scope: 'page',
      description: 'Page help',
      capture: true,
      handler: (e) => {
        order.push('capture');
        e.preventDefault();
      },
    });

    fireEvent.keyDown(document.body, { key: '?' });
    expect(order).toEqual(['capture']);
  });

  it('warns in dev when duplicate bindings are registered in the same scope', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registerHotkey({ combo: 'R', scope: 'page', description: 'First', handler: vi.fn() });
    registerHotkey({ combo: 'r', scope: 'page', description: 'Second', handler: vi.fn() });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Duplicate hotkey binding');
  });

  it('useHotkey registers on mount, respects enabled, and unregisters on unmount', () => {
    const handler = vi.fn();

    function TestComponent({ enabled = true }: { enabled?: boolean }) {
      const spec: HotkeySpec = {
        combo: 'R',
        scope: 'page',
        description: 'Refresh',
        enabled,
        handler,
      };
      useHotkey(spec);
      return null;
    }

    const { rerender, unmount } = render(<TestComponent enabled={true} />);
    expect(getRegisteredHotkeys()).toHaveLength(1);

    fireEvent.keyDown(document, { key: 'r' });
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(<TestComponent enabled={false} />);
    expect(getRegisteredHotkeys()).toHaveLength(0);

    fireEvent.keyDown(document, { key: 'r' });
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(<TestComponent enabled={true} />);
    expect(getRegisteredHotkeys()).toHaveLength(1);

    unmount();
    expect(getRegisteredHotkeys()).toHaveLength(0);
  });
});
