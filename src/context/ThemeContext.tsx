/**
 * ThemeContext — manages the colour-scheme preference (light / dark / system).
 *
 * Currently only 'default' (dark) is implemented.  The 'light' variant and a
 * 'system' auto-detect option are planned for a future iteration.
 *
 * Persisted via the project's `storage.ts` helpers rather than raw
 * localStorage calls, which are not safe in all browsing environments.
 *
 * For the high-contrast override see `ContrastContext.tsx`.
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

export type Theme = 'default';

// Font mode – default or dyslexia‑friendly
export type FontMode = 'default' | 'easyRead';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontMode: FontMode;
  setFontMode: (mode: FontMode) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Constants ───────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'creditra-theme' as const;
const FONT_MODE_STORAGE_KEY = 'creditra-font-mode' as const;

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readJson<Theme>(THEME_STORAGE_KEY, 'default'),
  );
  const [fontMode, setFontModeState] = useState<FontMode>(() =>
    readJson<FontMode>(FONT_MODE_STORAGE_KEY, 'default'),
  );

  // Apply theme class and font mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    // Theme handling (existing)
    root.classList.remove('theme-default');
    root.classList.add(`theme-${theme}`);
    writeJson<Theme>(THEME_STORAGE_KEY, theme);
    // Font mode handling
    if (fontMode === 'easyRead') {
      root.classList.add('easy-read');
    } else {
      root.classList.remove('easy-read');
    }
    writeJson<FontMode>(FONT_MODE_STORAGE_KEY, fontMode);
  }, [theme, fontMode]);

  const setTheme = (next: Theme) => setThemeState(next);
  const setFontMode = (next: FontMode) => setFontModeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontMode, setFontMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Returns the current theme context. Must be used inside a `<ThemeProvider>`. */
export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
