/**
 * ContrastContext — manages the high-contrast mode preference.
 *
 * Design decisions:
 *  - Uses the `[data-contrast="high"]` attribute on <html> so CSS overrides
 *    are scoped to a single attribute selector and never bleed into component
 *    internal hex values.
 *  - Persisted via the project's `storage.ts` helpers (safe localStorage
 *    wrappers) rather than raw localStorage calls. Storage is only written
 *    when the user explicitly toggles or sets a mode.
 *  - When no stored preference exists, initialises from the OS media queries
 *    `(prefers-contrast: more)` and `(forced-colors: active)` and subscribes
 *    to live changes.
 *  - Initialised synchronously from storage / matchMedia so there is no
 *    flash-of-wrong-contrast on first render.
 *  - Orthogonal to the theme (light/dark) context — the two can be combined
 *    freely.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { readJson, writeJson } from '../utils/storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContrastMode = 'normal' | 'high';
export type ContrastSource = 'user' | 'system';

interface ContrastContextValue {
  /** The active contrast mode. */
  contrastMode: ContrastMode;
  /** Whether the active mode comes from an explicit user choice or the OS setting. */
  source: ContrastSource;
  /** Toggle between 'normal' and 'high'. */
  toggleContrast: () => void;
  /** Directly set the contrast mode. */
  setContrastMode: (mode: ContrastMode) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'creditra-contrast' as const;
const CONTRAST_MORE_QUERY = '(prefers-contrast: more)';
const FORCED_COLORS_QUERY = '(forced-colors: active)';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isContrastMode(value: unknown): value is ContrastMode {
  return value === 'normal' || value === 'high';
}

function readStoredContrast(): ContrastMode | null {
  const raw = readJson<unknown>(STORAGE_KEY, null);
  return isContrastMode(raw) ? raw : null;
}

function getSystemContrast(): ContrastMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'normal';
  }
  const prefersMore = window.matchMedia(CONTRAST_MORE_QUERY)?.matches ?? false;
  const forcedColors = window.matchMedia(FORCED_COLORS_QUERY)?.matches ?? false;
  return prefersMore || forcedColors ? 'high' : 'normal';
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ContrastContext = createContext<ContrastContextValue | undefined>(
  undefined,
);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ContrastProvider({ children }: { children: ReactNode }) {
  // Synchronous reads so there is no flash on first paint.
  const [storedMode, setStoredMode] = useState<ContrastMode | null>(() =>
    readStoredContrast(),
  );
  const [systemMode, setSystemMode] = useState<ContrastMode>(() =>
    getSystemContrast(),
  );

  const source: ContrastSource = storedMode !== null ? 'user' : 'system';
  const contrastMode: ContrastMode = storedMode ?? systemMode;

  // Subscribe to OS contrast / forced-colors changes while following system.
  useEffect(() => {
    if (
      storedMode !== null ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const moreQuery = window.matchMedia(CONTRAST_MORE_QUERY);
    const forcedQuery = window.matchMedia(FORCED_COLORS_QUERY);

    const handleChange = () => {
      setSystemMode(
        moreQuery?.matches || forcedQuery?.matches ? 'high' : 'normal',
      );
    };

    handleChange();
    moreQuery?.addEventListener?.('change', handleChange);
    forcedQuery?.addEventListener?.('change', handleChange);

    return () => {
      moreQuery?.removeEventListener?.('change', handleChange);
      forcedQuery?.removeEventListener?.('change', handleChange);
    };
  }, [storedMode]);

  // Apply / remove the data attribute on <html> whenever mode changes.
  useEffect(() => {
    const root = document.documentElement;
    if (contrastMode === 'high') {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }
  }, [contrastMode]);

  const setContrastMode = (mode: ContrastMode) => {
    writeJson<ContrastMode>(STORAGE_KEY, mode);
    setStoredMode(mode);
  };

  const toggleContrast = () => {
    setStoredMode((prev) => {
      const current = prev ?? systemMode;
      const next: ContrastMode = current === 'high' ? 'normal' : 'high';
      writeJson<ContrastMode>(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <ContrastContext.Provider
      value={{ contrastMode, source, toggleContrast, setContrastMode }}
    >
      {children}
    </ContrastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns the current contrast context.
 * Must be used inside a `<ContrastProvider>`.
 */
export function useContrast(): ContrastContextValue {
  const ctx = useContext(ContrastContext);
  if (!ctx) {
    throw new Error('useContrast must be used within a ContrastProvider');
  }
  return ctx;
}
