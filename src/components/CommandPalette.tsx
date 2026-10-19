/**
 * CommandPalette — Cmd/Ctrl+K quick-navigation overlay.
 *
 * ## Keyboard contract
 * | Key         | Action                                         |
 * |-------------|------------------------------------------------|
 * | Cmd/Ctrl+K  | Toggle open/close (registered in App.tsx)      |
 * | ArrowDown   | Move selection to next item (wraps)            |
 * | ArrowUp     | Move selection to previous item (wraps)        |
 * | Enter       | Execute selected item                          |
 * | Escape      | Close palette, return focus to trigger element |
 *
 * ## Accessibility
 * - `role="dialog"` + `aria-modal="true"` scopes assistive-technology focus.
 * - `useFocusTrap` cycles Tab/Shift+Tab within the dialog and handles Escape.
 * - `useBodyScrollLock` prevents background scroll while the palette is open.
 * - `useInertBackdrop` applies `inert` + `aria-hidden` to the rest of the DOM.
 * - The search input carries `aria-autocomplete="list"`, `aria-controls` pointing
 *   at the listbox, and `aria-activedescendant` tracking the highlighted option.
 *   This gives screen readers continuous updates as the selection changes.
 * - Contrast ratios (verified against dark surface #0d1117):
 *   - Item labels #e6edf3 → ~13:1   ✓ AA
 *   - Descriptions #8b949e → ~4.8:1 ✓ AA
 * - `prefers-reduced-motion` collapses the entrance animation via CSS.
 * - `[data-motion="reduced"]` from ReducedMotionContext does the same at runtime.
 *
 * ## Design tokens
 * All colour and spacing values reference CSS custom properties defined in
 * `src/index.css` (e.g. `var(--accent)`, `var(--muted)`, `var(--text)`).
 * Fallback hex literals in the CSS mirror the default-theme token values and
 * are only used as a safety net; no component-internal magic values are used.
 *
 * @module CommandPalette
 */
import { useEffect, useRef, useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import { useDebounceValue } from '../hooks/useDebounceValue';
import './CommandPalette.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single entry in the command list.
 *
 * `action` is either:
 * - A route string navigated to via `react-router-dom`'s `useNavigate`.
 * - A zero-argument callback for in-place actions (e.g. opening a modal).
 *
 * Navigation items display a `↵` hint; callback items do not, because they
 * typically open an overlay rather than changing the page.
 */
export interface CommandItem {
  /** Stable identifier used as the React key and for `aria-activedescendant`. */
  id: string;
  /** Primary display text shown in the list. Searched by fuzzy filter. */
  label: string;
  /** Secondary description shown below the label. Also searched. */
  description?: string;
  /** Route path (string) or in-place callback. */
  action: string | (() => void);
  /** Decorative emoji or icon character. Marked `aria-hidden`. */
  icon?: string;
}

// ─── Default command registry ─────────────────────────────────────────────────

/**
 * Built-in navigation and quick-action items.
 *
 * Route strings must match entries in `src/App.tsx`'s `<Routes>`.
 * Keep this list sorted by expected usage frequency so the most useful
 * commands appear first in the default (empty-query) view.
 */
const DEFAULT_ITEMS: CommandItem[] = [
  { id: 'nav-dashboard',    label: 'Dashboard',           icon: '🏠',  action: '/',                          description: 'Go to Dashboard' },
  { id: 'nav-transactions', label: 'Transactions',         icon: '📋',  action: '/transactions',              description: 'View transaction history' },
  { id: 'nav-credit-lines', label: 'Credit Lines',         icon: '💳',  action: '/credit-lines',              description: 'Manage your credit lines' },
  { id: 'nav-repay',        label: 'Repay',                icon: '💰',  action: '/repay',                     description: 'Make a repayment' },
  { id: 'nav-draw-credit',  label: 'Draw',                 icon: '⬇️',  action: '/draw-credit',               description: 'Draw from a credit line' },
  { id: 'nav-open-credit',  label: 'Request Evaluation',   icon: '📝',  action: '/open-credit',               description: 'Apply for a new credit line' },
  { id: 'nav-auctions',     label: 'Dutch Auctions',       icon: '🔨',  action: '/dutch-auctions',            description: 'View active auctions' },
  { id: 'nav-linked',       label: 'Linked Accounts',      icon: '🔗',  action: '/linked-accounts',           description: 'Manage linked external accounts' },
  { id: 'nav-help',         label: 'Help Center',          icon: '❓',  action: '/help',                      description: 'Browse help articles' },
  { id: 'nav-notif-prefs',  label: 'Notification Settings',icon: '🔔',  action: '/notification-preferences',  description: 'Manage notification preferences' },
  { id: 'nav-profile-activity', label: 'Profile activity',  icon: '📈',  action: '/profile?tab=activity',       description: 'View your activity feed' },
];

/** Exported for tests and documentation of the default registry. */
export { DEFAULT_ITEMS as COMMAND_PALETTE_DEFAULT_ITEMS };

// ─── Fuzzy-search helpers ─────────────────────────────────────────────────────

/**
 * Normalise a string for fuzzy matching: lower-case and collapse whitespace.
 * Intentionally minimal — no Unicode normalisation or accent stripping needed
 * since all item labels are ASCII.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Filter `items` to those whose label or description contains `query` as a
 * substring after normalisation.
 *
 * This is an intentionally simple "needle in haystack" approach.  More
 * sophisticated scoring (e.g. Levenshtein distance, bigram similarity) can be
 * added later without changing the API.
 *
 * @param items  Full list of command items.
 * @param query  Raw user input (not yet normalised).
 * @returns      Subset of items that match, or all items when `query` is empty.
 */
function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const q = normalize(query);
  if (!q) return items;
  return items.filter(
    (item) =>
      normalize(item.label).includes(q) ||
      normalize(item.description ?? '').includes(q),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Props for `CommandPalette`.
 */
interface CommandPaletteProps {
  /** Whether the palette is currently visible. */
  isOpen: boolean;
  /** Callback to dismiss the palette (called on Esc, backdrop click, or item activation). */
  onClose: () => void;
  /**
   * The element that triggered the palette opening.
   * When provided, focus returns here on close — satisfying WCAG 2.4.11
   * (Focus Not Obscured) and the general focus-return contract for dialogs.
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Additional items merged with the built-in defaults.
   * Use this to surface context-sensitive commands (e.g. the currently open
   * credit line, pending actions) without hard-coding them in this file.
   */
  extraItems?: CommandItem[];
}

/**
 * Cmd/Ctrl+K command palette overlay.
 *
 * Renders a floating search dialog with fuzzy filtering, keyboard navigation,
 * and screen-reader support.  The dialog is mounted unconditionally in
 * `App.tsx` and toggled via `isOpen`; this avoids remounting costs and keeps
 * focus-trap state stable.
 *
 * @example
 * ```tsx
 * // App.tsx — wiring
 * const [isPaletteOpen, setIsPaletteOpen] = useState(false);
 * const paletteTriggerRef = useRef<HTMLElement | null>(null);
 *
 * useEffect(() => {
 *   const handler = (e: KeyboardEvent) => {
 *     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 *       e.preventDefault();
 *       paletteTriggerRef.current = document.activeElement as HTMLElement;
 *       setIsPaletteOpen((v) => !v);
 *     }
 *   };
 *   document.addEventListener('keydown', handler);
 *   return () => document.removeEventListener('keydown', handler);
 * }, []);
 *
 * <CommandPalette
 *   isOpen={isPaletteOpen}
 *   onClose={() => setIsPaletteOpen(false)}
 *   triggerRef={paletteTriggerRef}
 * />
 * ```
 */
export function CommandPalette({
  isOpen,
  onClose,
  triggerRef,
  extraItems = [],
}: CommandPaletteProps) {
  // Stable IDs for ARIA relationships — safe to call unconditionally.
  const modalId = 'command-palette';
  const inputId = useId();
  const listId = useId();

  const navigate = useNavigate();

  // ── Local state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  /**
   * Debounce user input by 80 ms to avoid re-filtering on every keystroke.
   * 80 ms is imperceptible to users but prevents unnecessary renders while
   * typing quickly.
   */
  const debouncedQuery = useDebounceValue(query, 80);
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge built-in defaults with any context-sensitive extras.
  const allItems = [...DEFAULT_ITEMS, ...extraItems];
  const results = filterItems(allItems, debouncedQuery);

  // ── Side-effects ───────────────────────────────────────────────────────────

  /** Reset search query and selection whenever the palette opens. */
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  /**
   * Clamp `activeIndex` to the current result set length.
   * Without this, an index of 3 could point past the end of a 2-item
   * filtered result, leaving no item visually highlighted.
   */
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // ── A11y hooks ─────────────────────────────────────────────────────────────

  /**
   * Trap keyboard focus inside `.cp-dialog`.
   * Handles Tab / Shift+Tab cycling and Escape (fires `onClose`).
   * Returns a ref to attach to the dialog element.
   */
  const containerRef = useFocusTrap({ isActive: isOpen, triggerRef, onEscape: onClose });

  /** Prevent the page from scrolling behind the overlay. */
  useBodyScrollLock({ isLocked: isOpen });

  /**
   * Mark all non-palette DOM as `inert` + `aria-hidden` while open.
   * This prevents screen readers from accidentally reading background content.
   */
  useInertBackdrop({ isInert: isOpen, modalId });

  /**
   * Move focus directly to the search input when the palette opens.
   * `useFocusTrap` already focuses the first focusable element; this override
   * ensures the input (which may not always be first) receives focus even if
   * the close button precedes it in the DOM.
   */
  useEffect(() => {
    if (isOpen) {
      // Small delay aligns with useFocusTrap's 50 ms initialisation timeout.
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /**
   * Execute a command item:
   * 1. Close the palette (restores focus to `triggerRef`).
   * 2. Navigate to the route or invoke the callback.
   *
   * Closing before navigation prevents a flash where the palette and the new
   * page are both visible simultaneously.
   */
  function activate(item: CommandItem) {
    onClose();
    if (typeof item.action === 'string') {
      navigate(item.action);
    } else {
      item.action();
    }
  }

  /**
   * Handle keyboard navigation within the dialog.
   *
   * Arrow keys move the highlighted index and wrap around at list boundaries.
   * Enter activates the currently highlighted item.
   * (Escape is handled upstream by `useFocusTrap`'s `onEscape` option.)
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) activate(results[activeIndex]);
    }
  }

  // ── Early return ───────────────────────────────────────────────────────────

  // Unmount the entire overlay tree when closed rather than hiding with CSS.
  // This keeps the DOM lean and ensures ARIA attributes never conflict with
  // other open modals.
  if (!isOpen) return null;

  // ── Derived ARIA values ────────────────────────────────────────────────────

  /**
   * `aria-activedescendant` must point to the ID of the currently highlighted
   * option element so screen readers announce selection changes as the user
   * navigates with arrow keys.
   */
  const activeItemId = results[activeIndex]
    ? `cp-item-${results[activeIndex].id}`
    : undefined;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div id={modalId} className="cp-overlay" data-testid="command-palette">
      {/*
       * Backdrop: click-to-close for pointer users.
       * `aria-hidden` excludes it from the AT reading order — the dialog's
       * `aria-modal` already restricts AT focus to the dialog content.
       */}
      <div className="cp-backdrop" aria-hidden="true" onClick={onClose} />

      {/*
       * Dialog container
       * role="dialog" + aria-modal="true" together signal to screen readers
       * that content outside the dialog is inert while it is open.
       */}
      <div
        ref={containerRef}
        className="cp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* ── Search row ─────────────────────────────────────────────────── */}
        <div className="cp-search-row">
          {/* Decorative ⌘ glyph; aria-hidden so AT skips it. */}
          <span className="cp-search-icon" aria-hidden="true">⌘</span>

          {/*
           * Search input.
           *
           * `aria-autocomplete="list"` indicates that a list of suggestions is
           * displayed.  Combined with `aria-controls` (pointing at the listbox)
           * and `aria-activedescendant` (tracking the highlighted item), this
           * gives screen readers full visibility into the current state without
           * requiring roving tabindex on the list items themselves.
           */}
          <input
            ref={inputRef}
            id={inputId}
            className="cp-input"
            type="text"
            placeholder="Search commands and pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={activeItemId}
            aria-label="Search commands and pages"
          />

          {/* Close button — visible affordance for pointer/touch users. */}
          <button
            type="button"
            className="cp-close"
            aria-label="Close command palette"
            onClick={onClose}
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        {/* ── Results list ───────────────────────────────────────────────── */}
        {/*
         * role="listbox" + role="option" on each child satisfies the ARIA
         * listbox pattern.  `aria-selected` on options conveys the current
         * keyboard selection to screen readers.
         */}
        <ul
          id={listId}
          className="cp-list"
          role="listbox"
          aria-label="Commands"
        >
          {/* Empty state — shown when the query yields no matches. */}
          {results.length === 0 && (
            <li className="cp-empty" role="option" aria-selected="false">
              No results for <strong>"{query}"</strong>
            </li>
          )}

          {results.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === activeIndex}>
              {/*
               * Each item is a `<button>` (not an `<a>`) because:
               * - Navigation items call `navigate()` imperatively.
               * - Callback items don't have a URL.
               * - Both need click + keyboard activation, which `<button>` provides.
               *
               * `tabIndex={-1}` keeps the buttons out of the Tab order;
               * keyboard navigation is handled entirely via arrow keys on the
               * dialog container, with `aria-activedescendant` tracking focus
               * for AT rather than real DOM focus.
               *
               * `onMouseEnter` syncs visual hover with keyboard selection so
               * the two never conflict.
               */}
              <button
                id={`cp-item-${item.id}`}
                type="button"
                className={`cp-item${index === activeIndex ? ' cp-item--active' : ''}`}
                onClick={() => activate(item)}
                onMouseEnter={() => setActiveIndex(index)}
                tabIndex={-1}
              >
                {item.icon && (
                  <span className="cp-item-icon" aria-hidden="true">{item.icon}</span>
                )}
                <span className="cp-item-text">
                  <span className="cp-item-label">{item.label}</span>
                  {item.description && (
                    <span className="cp-item-desc">{item.description}</span>
                  )}
                </span>
                {/* ↵ hint is only meaningful for navigation routes. */}
                {typeof item.action === 'string' && (
                  <span className="cp-item-hint" aria-hidden="true">
                    <kbd>↵</kbd>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/*
         * Footer keyboard legend.
         * Marked `aria-hidden` because it is purely visual — the functionality
         * it describes is already communicated via ARIA roles above.
         */}
        <div className="cp-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
