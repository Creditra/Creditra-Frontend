/**
 * ContrastContext tests
 *
 * Cover:
 *  1. Default mode is 'normal', no data-contrast attribute applied.
 *  2. toggleContrast switches to 'high' and applies [data-contrast="high"].
 *  3. Toggling again returns to 'normal' and removes the attribute.
 *  4. setContrastMode('high') / ('normal') works directly.
 *  5. Mode is persisted to localStorage via writeJson.
 *  6. Mode is read from localStorage on mount (readJson).
 *  7. useContrast throws when used outside a provider.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContrastProvider, useContrast } from './ContrastContext';

// ── Controllable matchMedia mock ─────────────────────────────────────────────

type MediaChangeListener = (event: MediaQueryListEvent) => void;

function installMatchMediaMock(initialMatches: Record<string, boolean> = {}) {
  const state = new Map<string, boolean>(Object.entries(initialMatches));
  const listeners = new Map<string, Set<MediaChangeListener>>();

  const getOrCreateSet = (query: string) => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };

  const mockMatchMedia = vi.fn((query: string): MediaQueryList => {
    return {
      get matches() {
        return state.get(query) ?? false;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((type: string, cb: EventListenerOrEventListenerObject) => {
        if (type === 'change' && typeof cb === 'function') {
          getOrCreateSet(query).add(cb as MediaChangeListener);
        }
      }),
      removeEventListener: vi.fn((type: string, cb: EventListenerOrEventListenerObject) => {
        if (type === 'change' && typeof cb === 'function') {
          getOrCreateSet(query).delete(cb as MediaChangeListener);
        }
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaQueryList;
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia,
  });

  return {
    setMatches(query: string, matches: boolean) {
      state.set(query, matches);
      const event = { matches, media: query } as MediaQueryListEvent;
      for (const cb of getOrCreateSet(query)) {
        cb(event);
      }
    },
  };
}

// ── Test helper component ────────────────────────────────────────────────────

function TestConsumer() {
  const { contrastMode, source, toggleContrast, setContrastMode } = useContrast();
  return (
    <div>
      <span data-testid="mode">{contrastMode}</span>
      <span data-testid="source">{source}</span>
      <button onClick={toggleContrast}>toggle</button>
      <button onClick={() => setContrastMode('high')}>set-high</button>
      <button onClick={() => setContrastMode('normal')}>set-normal</button>
    </div>
  );
}

function renderWithProvider(preloadedStorage?: Record<string, string>) {
  if (preloadedStorage) {
    for (const [k, v] of Object.entries(preloadedStorage)) {
      window.localStorage.setItem(k, v);
    }
  }
  return render(
    <ContrastProvider>
      <TestConsumer />
    </ContrastProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ContrastContext', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Remove the attribute and storage set by a previous test.
    document.documentElement.removeAttribute('data-contrast');
    window.localStorage.clear();
    installMatchMediaMock();
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('defaults to normal mode with no stored value and does not write to storage', () => {
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('system');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
    expect(window.localStorage.getItem('creditra-contrast')).toBeNull();
  });

  it('applies [data-contrast="high"] after toggling on', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  });

  it('removes [data-contrast] attribute when toggling back to normal', async () => {
    renderWithProvider();
    const btn = screen.getByRole('button', { name: 'toggle' });
    await userEvent.click(btn); // → high
    await userEvent.click(btn); // → normal
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('setContrastMode("high") applies attribute and updates state', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'set-high' }));
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  });

  it('setContrastMode("normal") removes attribute', async () => {
    // Start in high mode
    renderWithProvider({ 'creditra-contrast': '"high"' });
    await userEvent.click(screen.getByRole('button', { name: 'set-normal' }));
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('persists mode to localStorage when toggled', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    const stored = window.localStorage.getItem('creditra-contrast');
    expect(stored).toBe('"high"');
  });

  it('reads persisted high mode from localStorage on mount', () => {
    renderWithProvider({ 'creditra-contrast': '"high"' });
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
  });

  it('falls back to normal when stored value is invalid', () => {
    renderWithProvider({ 'creditra-contrast': 'not-valid-json{' });
    expect(screen.getByTestId('mode').textContent).toBe('normal');
  });

  it('throws when useContrast is used outside a provider', () => {
    // Suppress React's error console noise in this intentional throw test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Naked() {
      useContrast();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(
      'useContrast must be used within a ContrastProvider',
    );
    spy.mockRestore();
  });

  it('initialises to high when prefers-contrast: more matches and does not write to storage', () => {
    installMatchMediaMock({ '(prefers-contrast: more)': true });
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(screen.getByTestId('source').textContent).toBe('system');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    expect(window.localStorage.getItem('creditra-contrast')).toBeNull();
  });

  it('initialises to high when forced-colors: active matches', () => {
    installMatchMediaMock({ '(forced-colors: active)': true });
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(screen.getByTestId('source').textContent).toBe('system');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    expect(window.localStorage.getItem('creditra-contrast')).toBeNull();
  });

  it('stays high when both queries match and only one turns off', () => {
    const mm = installMatchMediaMock({
      '(prefers-contrast: more)': true,
      '(forced-colors: active)': true,
    });
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('high');

    act(() => {
      mm.setMatches('(prefers-contrast: more)', false);
    });
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');

    act(() => {
      mm.setMatches('(forced-colors: active)', false);
    });
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('updates live when OS media query changes while no explicit choice exists', () => {
    const mm = installMatchMediaMock();
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('system');

    act(() => {
      mm.setMatches('(prefers-contrast: more)', true);
    });
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    expect(window.localStorage.getItem('creditra-contrast')).toBeNull();

    act(() => {
      mm.setMatches('(prefers-contrast: more)', false);
    });
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('explicit user choice overrides OS preference and ignores later OS changes', async () => {
    const mm = installMatchMediaMock({ '(prefers-contrast: more)': true });
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(screen.getByTestId('source').textContent).toBe('system');

    // User toggles to normal despite OS asking for more contrast
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('user');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
    expect(window.localStorage.getItem('creditra-contrast')).toBe('"normal"');

    // Later OS changes must not override the explicit user choice
    act(() => {
      mm.setMatches('(prefers-contrast: more)', false);
      mm.setMatches('(prefers-contrast: more)', true);
    });
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('user');
  });

  it('respects stored normal preference even when OS requests high contrast', () => {
    installMatchMediaMock({ '(prefers-contrast: more)': true });
    renderWithProvider({ 'creditra-contrast': '"normal"' });
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('user');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('handles missing window.matchMedia gracefully', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    renderWithProvider();
    expect(screen.getByTestId('mode').textContent).toBe('normal');
    expect(screen.getByTestId('source').textContent).toBe('system');
    expect(document.documentElement.getAttribute('data-contrast')).toBeNull();
  });

  it('treats corrupted stored value as no preference and falls back to OS setting', () => {
    installMatchMediaMock({ '(prefers-contrast: more)': true });
    renderWithProvider({ 'creditra-contrast': '"bogus-value"' });
    expect(screen.getByTestId('mode').textContent).toBe('high');
    expect(screen.getByTestId('source').textContent).toBe('system');
  });
});
