import { useEffect, useRef, useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import { useDebounceValue } from '../hooks/useDebounceValue';
import './CommandPalette.css';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  /** Route to navigate to, or an action callback */
  action: string | (() => void);
  /** Decorative icon character / emoji */
  icon?: string;
}

const DEFAULT_ITEMS: CommandItem[] = [
  { id: 'nav-dashboard',              label: 'Dashboard',                  icon: '🏠', action: '/',                          description: 'Go to Dashboard' },
  { id: 'nav-transactions',           label: 'Transactions',               icon: '📋', action: '/transactions',              description: 'View transaction history' },
  { id: 'nav-credit-lines',           label: 'Credit Lines',               icon: '💳', action: '/credit-lines',              description: 'Manage your credit lines' },
  { id: 'nav-open-credit',            label: 'Request Evaluation',         icon: '📝', action: '/open-credit',               description: 'Apply for a new credit line' },
  { id: 'nav-draw-credit',            label: 'Draw',                       icon: '⬇️',  action: '/draw-credit',              description: 'Draw from a credit line' },
  { id: 'nav-auctions',               label: 'Dutch Auctions',             icon: '🔨', action: '/dutch-auctions',            description: 'View active auctions' },
  { id: 'nav-linked-accounts',        label: 'Linked Accounts',            icon: '🔗', action: '/linked-accounts',           description: 'Manage linked bank accounts' },
  { id: 'nav-notification-prefs',     label: 'Notification Preferences',   icon: '🔔', action: '/notification-preferences',  description: 'Manage notification settings' },
  { id: 'nav-help',                   label: 'Help Center',                icon: '❓', action: '/help',                      description: 'Browse help articles' },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const q = normalize(query);
  if (!q) return items;
  return items.filter(
    (item) =>
      normalize(item.label).includes(q) ||
      normalize(item.description ?? '').includes(q),
  );
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Extra items (e.g. saved credit lines) merged with defaults */
  extraItems?: CommandItem[];
}

export function CommandPalette({
  isOpen,
  onClose,
  triggerRef,
  extraItems = [],
}: CommandPaletteProps) {
  const modalId = 'command-palette';
  const inputId = useId();
  const listId = useId();

  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebounceValue(query, 80);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = [...DEFAULT_ITEMS, ...extraItems];
  const results = filterItems(allItems, debouncedQuery);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Clamp activeIndex when results change
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const containerRef = useFocusTrap({ isActive: isOpen, triggerRef, onEscape: onClose });
  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  // Focus input immediately when open (useFocusTrap focuses first focusable,
  // but we want the input specifically)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  function activate(item: CommandItem) {
    onClose();
    if (typeof item.action === 'string') {
      navigate(item.action);
    } else {
      item.action();
    }
  }

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

  if (!isOpen) return null;

  const activeItemId = results[activeIndex] ? `cp-item-${results[activeIndex].id}` : undefined;

  return (
    <div id={modalId} className="cp-overlay" data-testid="command-palette">
      <div className="cp-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={containerRef}
        className="cp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="cp-search-row">
          <span className="cp-search-icon" aria-hidden="true">⌘</span>
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
          <button
            type="button"
            className="cp-close"
            aria-label="Close command palette"
            onClick={onClose}
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        {/* Results list */}
        <ul
          id={listId}
          className="cp-list"
          role="listbox"
          aria-label="Commands"
        >
          {results.length === 0 && (
            <li className="cp-empty" role="option" aria-selected="false">
              No results for <strong>"{query}"</strong>
            </li>
          )}
          {results.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === activeIndex}>
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
                {typeof item.action === 'string' && (
                  <span className="cp-item-hint" aria-hidden="true">
                    <kbd>↵</kbd>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="cp-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
