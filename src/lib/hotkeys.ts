/**
 * Central keyboard hotkey registry and React hook.
 *
 * Owns document-level `keydown` listeners (at most one bubble-phase listener and
 * one capture-phase listener), editable-target guarding, scope metadata,
 * dev-mode duplicate binding detection, and reactive snapshots for
 * `ShortcutHelpOverlay`.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { isEditableTarget } from '../utils/isEditableTarget';

export type HotkeyScope = 'global' | 'page' | 'modal';

export const HOTKEY_SCOPE_ORDER: readonly HotkeyScope[] = ['global', 'page', 'modal'];

export const HOTKEY_SCOPE_LABELS: Record<HotkeyScope, string> = {
  global: 'Global',
  page: 'Page',
  modal: 'Modal',
};

export interface HotkeySpec {
  /** Key combination, e.g. `'?'`, `'Mod+K'`, `'Shift+R'`, `'Escape'`, `'ArrowLeft'`, `'R'`. */
  combo: string;
  /** Scope used for grouping in `ShortcutHelpOverlay` and conflict detection. */
  scope: HotkeyScope;
  /** Human-readable description displayed in `ShortcutHelpOverlay`. */
  description: string;
  /** Handler invoked when the key combo matches. */
  handler: (event: KeyboardEvent) => void;
  /** Whether this binding is currently active. Defaults to `true`. */
  enabled?: boolean;
  /** Listen during the capture phase so this runs before bubble-phase handlers. Defaults to `false`. */
  capture?: boolean;
  /** Allow firing when the target or active element is editable. Defaults to `false`. */
  allowInEditable?: boolean;
  /** Ignore events that already have `defaultPrevented === true`. Defaults to `true`. */
  ignoreDefaultPrevented?: boolean;
}

export interface RegisteredHotkey {
  id: number;
  combo: string;
  normalizedCombo: string;
  keys: string[];
  scope: HotkeyScope;
  description: string;
  capture: boolean;
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  isPunctuation: boolean;
  normalized: string;
}

interface InternalBinding extends RegisteredHotkey {
  parsed: ParsedCombo;
  allowInEditable: boolean;
  ignoreDefaultPrevented: boolean;
  getHandler: () => (event: KeyboardEvent) => void;
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
  space: ' ',
};

const DISPLAY_KEY_LABELS: Record<string, string> = {
  escape: 'Esc',
  esc: 'Esc',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  ' ': 'Space',
};

function isSinglePunctuation(key: string): boolean {
  return key.length === 1 && !/^[a-z0-9]$/i.test(key);
}

/** Parses a combo string like `'Shift+R'` or `'Mod+K'` into structured modifier flags and key. */
export function parseCombo(combo: string): ParsedCombo {
  const parts = combo
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  let mod = false;
  let ctrl = false;
  let meta = false;
  let alt = false;
  let shift = false;
  let rawKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod') {
      mod = true;
    } else if (lower === 'ctrl' || lower === 'control') {
      ctrl = true;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command') {
      meta = true;
    } else if (lower === 'alt' || lower === 'option') {
      alt = true;
    } else if (lower === 'shift') {
      shift = true;
    } else {
      rawKey = part;
    }
  }

  const lowerKey = rawKey.toLowerCase();
  const key = KEY_ALIASES[lowerKey] ?? lowerKey;
  const isPunctuation = isSinglePunctuation(key);

  const normalizedParts: string[] = [];
  if (mod) normalizedParts.push('mod');
  if (ctrl) normalizedParts.push('ctrl');
  if (meta) normalizedParts.push('meta');
  if (alt) normalizedParts.push('alt');
  if (shift) normalizedParts.push('shift');
  normalizedParts.push(key);

  return {
    key,
    mod,
    ctrl,
    meta,
    alt,
    shift,
    isPunctuation,
    normalized: normalizedParts.join('+'),
  };
}

/** Formats a combo string into display tokens for `<kbd>` elements. */
export function formatComboKeys(combo: string): string[] {
  const parsed = parseCombo(combo);
  const tokens: string[] = [];

  if (parsed.mod) tokens.push('Ctrl/⌘');
  if (parsed.ctrl) tokens.push('Ctrl');
  if (parsed.meta) tokens.push('⌘');
  if (parsed.alt) tokens.push('Alt');
  if (parsed.shift) tokens.push('Shift');

  const displayKey =
    DISPLAY_KEY_LABELS[parsed.key] ??
    (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key);
  tokens.push(displayKey);

  return tokens;
}

function matchesEvent(parsed: ParsedCombo, event: KeyboardEvent): boolean {
  const eventKey = event.key.toLowerCase();
  if (eventKey !== parsed.key) return false;

  if (parsed.mod) {
    if (!event.metaKey && !event.ctrlKey) return false;
  } else {
    if (event.ctrlKey !== parsed.ctrl) return false;
    if (event.metaKey !== parsed.meta) return false;
  }

  if (event.altKey !== parsed.alt) return false;

  // Punctuation keys like '?' may have shiftKey=true on real keyboards and
  // shiftKey=false in synthetic tests, so only enforce shift when explicitly requested.
  if (parsed.isPunctuation && !parsed.shift) {
    return true;
  }

  return event.shiftKey === parsed.shift;
}

// ── Module-level singleton registry ──────────────────────────────────────────

let nextBindingId = 1;
const bindings = new Map<number, InternalBinding>();
const listeners = new Set<() => void>();
let snapshotCache: readonly RegisteredHotkey[] = [];

let hasBubbleListener = false;
let hasCaptureListener = false;

function dispatchForPhase(event: KeyboardEvent, capture: boolean) {
  for (const binding of bindings.values()) {
    if (binding.capture !== capture) continue;
    if (binding.ignoreDefaultPrevented && event.defaultPrevented) continue;
    if (!matchesEvent(binding.parsed, event)) continue;
    if (
      !binding.allowInEditable &&
      (isEditableTarget(event.target) || isEditableTarget(document.activeElement))
    ) {
      continue;
    }

    binding.getHandler()(event);
  }
}

function handleBubbleKeyDown(event: KeyboardEvent) {
  dispatchForPhase(event, false);
}

function handleCaptureKeyDown(event: KeyboardEvent) {
  dispatchForPhase(event, true);
}

function syncDocumentListeners() {
  if (typeof document === 'undefined') return;

  let needsBubble = false;
  let needsCapture = false;
  for (const binding of bindings.values()) {
    if (binding.capture) {
      needsCapture = true;
    } else {
      needsBubble = true;
    }
  }

  if (needsBubble && !hasBubbleListener) {
    document.addEventListener('keydown', handleBubbleKeyDown, false);
    hasBubbleListener = true;
  } else if (!needsBubble && hasBubbleListener) {
    document.removeEventListener('keydown', handleBubbleKeyDown, false);
    hasBubbleListener = false;
  }

  if (needsCapture && !hasCaptureListener) {
    document.addEventListener('keydown', handleCaptureKeyDown, true);
    hasCaptureListener = true;
  } else if (!needsCapture && hasCaptureListener) {
    document.removeEventListener('keydown', handleCaptureKeyDown, true);
    hasCaptureListener = false;
  }
}

function rebuildSnapshot() {
  snapshotCache = Array.from(bindings.values()).map(
    ({ id, combo, normalizedCombo, keys, scope, description, capture }) => ({
      id,
      combo,
      normalizedCombo,
      keys,
      scope,
      description,
      capture,
    }),
  );
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Returns the current immutable snapshot of all registered hotkeys. */
export function getRegisteredHotkeys(): readonly RegisteredHotkey[] {
  return snapshotCache;
}

/** React hook returning the current list of registered hotkeys, updating on change. */
export function useRegisteredHotkeys(): readonly RegisteredHotkey[] {
  return useSyncExternalStore(subscribe, getRegisteredHotkeys, getRegisteredHotkeys);
}

/**
 * Imperatively registers a hotkey binding with the central registry.
 * Returns a cleanup function that unregisters the binding.
 */
export function registerHotkey(
  spec: Omit<HotkeySpec, 'handler'> & { getHandler: () => (event: KeyboardEvent) => void },
): () => void;
export function registerHotkey(spec: HotkeySpec): () => void;
export function registerHotkey(
  spec:
    | HotkeySpec
    | (Omit<HotkeySpec, 'handler'> & { getHandler: () => (event: KeyboardEvent) => void }),
): () => void {
  if (spec.enabled === false) {
    return () => {};
  }

  const parsed = parseCombo(spec.combo);
  const capture = spec.capture ?? false;

  if (import.meta.env.DEV) {
    for (const existing of bindings.values()) {
      if (existing.normalizedCombo === parsed.normalized && existing.scope === spec.scope) {
        console.warn(
          `[hotkeys] Duplicate hotkey binding "${spec.combo}" in scope "${spec.scope}" ` +
            `(existing: "${existing.description}", new: "${spec.description}").`,
        );
        break;
      }
    }
  }

  const id = nextBindingId++;
  const getHandler = 'getHandler' in spec ? spec.getHandler : () => spec.handler;

  bindings.set(id, {
    id,
    combo: spec.combo,
    normalizedCombo: parsed.normalized,
    keys: formatComboKeys(spec.combo),
    scope: spec.scope,
    description: spec.description,
    capture,
    parsed,
    allowInEditable: spec.allowInEditable ?? false,
    ignoreDefaultPrevented: spec.ignoreDefaultPrevented ?? true,
    getHandler,
  });

  syncDocumentListeners();
  rebuildSnapshot();

  return () => {
    if (bindings.delete(id)) {
      syncDocumentListeners();
      rebuildSnapshot();
    }
  };
}

/**
 * React hook that registers a keyboard shortcut in the central registry
 * and automatically unregisters it on unmount or when `enabled` becomes `false`.
 */
export function useHotkey(spec: HotkeySpec): void {
  const handlerRef = useRef(spec.handler);
  handlerRef.current = spec.handler;

  const {
    combo,
    scope,
    description,
    enabled = true,
    capture = false,
    allowInEditable = false,
    ignoreDefaultPrevented = true,
  } = spec;

  useEffect(() => {
    if (!enabled) return;

    return registerHotkey({
      combo,
      scope,
      description,
      enabled,
      capture,
      allowInEditable,
      ignoreDefaultPrevented,
      getHandler: () => handlerRef.current,
    });
  }, [combo, scope, description, enabled, capture, allowInEditable, ignoreDefaultPrevented]);
}

/** Clears all registered hotkeys and removes document listeners. Intended for tests. */
export function resetHotkeyRegistry(): void {
  bindings.clear();
  syncDocumentListeners();
  rebuildSnapshot();
}
