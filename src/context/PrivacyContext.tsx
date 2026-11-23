/**
 * PrivacyContext — app-wide "hide my numbers" preference.
 *
 * When enabled, monetary amounts are replaced by `<Amount>`'s mask rather than
 * merely blurred, so the real values are never present in the DOM for
 * screenshots, shoulder-surfing or assistive tech. Percentages, token symbols
 * and transaction hashes are intentionally left visible: they are not
 * sensitive on their own and masking them hurts comprehension.
 *
 * Persistence goes through the safe storage wrappers (private-mode safe,
 * quota-safe) and is read synchronously so the first paint is already masked.
 * `[data-privacy-mode="on"]` is mirrored onto <html> for CSS-only consumers.
 *
 * The hook returns a safe default when used outside the provider so isolated
 * components (tests, Storybook) still render.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { readJson, writeJson } from '../utils/storage';
import { PRIVACY_MODE_STORAGE_KEY } from '../constants/storageKeys';

export { PRIVACY_MODE_STORAGE_KEY };

export interface PrivacyContextValue {
  /** True when sensitive amounts should be masked. */
  privacyMode: boolean;
  /** Flip the current preference. */
  togglePrivacyMode: () => void;
  /** Set the preference explicitly. */
  setPrivacyMode: (enabled: boolean) => void;
}

const NOOP: PrivacyContextValue = {
  privacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
};

const PrivacyContext = createContext<PrivacyContextValue>(NOOP);

export function PrivacyModeProvider({
  children,
  initialPrivacyMode,
}: {
  children: ReactNode;
  /** Deterministic seed for tests; when omitted, storage is read. */
  initialPrivacyMode?: boolean;
}) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(() => {
    if (initialPrivacyMode !== undefined) return initialPrivacyMode;
    return readJson<boolean>(PRIVACY_MODE_STORAGE_KEY, false) === true;
  });

  useEffect(() => {
    writeJson(PRIVACY_MODE_STORAGE_KEY, privacyMode);
    const root = document.documentElement;
    if (privacyMode) {
      root.setAttribute('data-privacy-mode', 'on');
    } else {
      root.removeAttribute('data-privacy-mode');
    }
  }, [privacyMode]);

  const setPrivacyMode = useCallback((enabled: boolean) => {
    setPrivacyModeState(enabled);
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyModeState((previous) => !previous);
  }, []);

  return (
    <PrivacyContext.Provider
      value={{ privacyMode, togglePrivacyMode, setPrivacyMode }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacyMode(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
