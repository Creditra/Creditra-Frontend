import { act, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  TransactionHistorySkeleton,
  TRANSACTION_SKELETON_ROWS,
} from './TransactionHistorySkeleton';
import { TransactionHistory } from '../pages/TransactionHistory';
import { NotificationProvider } from '../context/NotificationContext';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * Read the stylesheets from disk rather than via `?raw`: this vitest config
 * runs with CSS handling disabled, so a `?raw` import resolves to an empty
 * string and every source assertion would pass vacuously.
 */
const readCss = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

/** Strips `/* … *​/` blocks so assertions inspect rules, not prose. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const transactionHistoryCss = stripComments(readCss('../pages/TransactionHistory.css'));
const skeletonLayoutCss = stripComments(readCss('./TransactionHistorySkeleton.css'));

/**
 * TransactionHistorySkeleton — shape-parity tests (issue #854)
 *
 * jsdom does not apply stylesheets, so these tests cannot measure pixels.
 * They instead guard the property that *makes* the pixels match: the skeleton
 * renders the same DOM shape and the same layout-bearing class names as the
 * loaded page, so both states are laid out by the same rules in
 * `TransactionHistory.css`.
 *
 * That is the regression these tests exist to catch — if either side grows,
 * loses, or renames a structural block, the parity assertions fail rather than
 * the two silently drifting apart the way they had before this change.
 */

/** Renders the loaded page so its DOM can be compared against the skeleton. */
function renderLoadedPage() {
  const result = render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/transactions']}>
        <TransactionHistory />
      </MemoryRouter>
    </NotificationProvider>,
  );
  // Flush the zero-delay first-paint loading timer.
  act(() => {
    vi.advanceTimersByTime(1);
  });
  return result;
}

/** Class names that determine the page's block-level geometry. */
const STRUCTURAL_CLASSES = [
  'transaction-history-page',
  'th-header',
  'th-header-actions',
  'export-actions',
  'th-export-help',
  'th-stats',
  'th-stat-card',
  'th-stat-icon',
  'th-stat-content',
  'th-stat-label',
  'th-stat-value',
  'th-filters',
  'th-filter-group',
  'th-filter-group-wide',
  'th-filter-label',
  'th-subgroup',
  'th-chip-group',
  'th-filter-chip',
  'date-range-custom-fields',
  'date-range-custom-field',
  'amount-range-chips',
  'amount-range-actions',
  'amount-range-custom-trigger',
  'th-search-group',
  'th-search-label-row',
  'th-search-shortcuts',
  'th-search-combobox',
  'th-filter-results',
  'th-table-container',
  'th-table',
  'tx-row',
  'tx-date',
  'tx-date-main',
  'tx-date-sub',
  'tx-type',
  'tx-type-badge',
  'tx-amount',
  'tx-line',
  'tx-line-name',
  'tx-line-id',
  'tx-status',
  'tx-status-badge',
  'tx-hash',
  'tx-hash-actions',
  'tx-expand',
  'th-pagination',
  'th-page-btn',
  'th-page-info',
] as const;

describe('TransactionHistorySkeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('exposes a named status region with aria-busy while loading', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      const region = container.querySelector('[role="status"]');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-busy', 'true');
      expect(region).toHaveAttribute('aria-label', 'Loading transaction history');
    });

    it('hides every placeholder subtree from assistive technology', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      // The representative sample strings used to size the shimmer bars must
      // never reach a screen reader, so each top-level block is aria-hidden.
      for (const selector of [
        '.th-header',
        '.th-export-help',
        '.th-stats',
        '.th-filters',
        '.th-table-container',
      ]) {
        expect(container.querySelector(selector)).toHaveAttribute('aria-hidden', 'true');
      }
    });

    it('renders no focusable elements inside the aria-hidden placeholder chrome', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      // The skeleton renders the page's real <select>/<input> elements for
      // exact box metrics, but every one is disabled — so the aria-hidden
      // subtree cannot take keyboard focus (WCAG 2.1 AA — SC 2.4.3), and axe's
      // aria-hidden-focus rule stays satisfied.
      const focusable = container.querySelectorAll(
        'a[href], button, textarea, [tabindex], input:not(:disabled), select:not(:disabled)',
      );
      expect(focusable).toHaveLength(0);

      // Guard the premise: the controls really are present and really are
      // disabled, so this test cannot pass vacuously.
      const controls = container.querySelectorAll('input, select');
      expect(controls.length).toBeGreaterThan(0);
      controls.forEach((control) => expect(control).toBeDisabled());
    });
  });

  // ── Shape parity with the loaded page ─────────────────────────────────────

  describe('shape parity with the loaded page', () => {
    it('reuses every layout-bearing class name the loaded page renders', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      const missing = STRUCTURAL_CLASSES.filter(
        (className) =>
          loaded.querySelector(`.${className}`) !== null &&
          skeleton.querySelector(`.${className}`) === null,
      );

      expect(missing).toEqual([]);
    });

    it('is rooted in .transaction-history-page so page padding and max-width match', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      // Before this change the skeleton used a private `.th-skeleton` wrapper
      // with its own `padding: 0 1.5rem 2rem`, so content shifted sideways on
      // reveal. The wrapper must carry the page class itself.
      const root = container.firstElementChild;
      expect(root).toHaveClass('transaction-history-page');
      expect(root).toHaveClass('th-skeleton');
    });

    it('renders the page header, which the previous skeleton omitted entirely', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      expect(skeleton.querySelector('.th-header h1')).toBeInTheDocument();
      expect(skeleton.querySelector('.th-header .subtitle')).toBeInTheDocument();
      // Both export buttons, so the header actions row is the same height.
      expect(loaded.querySelectorAll('.export-actions .export-btn')).toHaveLength(2);
      expect(skeleton.querySelectorAll('.export-actions .export-btn')).toHaveLength(2);
    });

    it('renders the same number of stat cards as the loaded page', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      expect(skeleton.querySelectorAll('.th-stat-card')).toHaveLength(
        loaded.querySelectorAll('.th-stat-card').length,
      );
    });

    it('renders the same number of filter chips as the loaded filter bar', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      // The filter bar wraps over several rows; an under-count here is exactly
      // what made the old single-row filter placeholder too short.
      expect(skeleton.querySelectorAll('.th-filters .th-filter-chip')).toHaveLength(
        loaded.querySelectorAll('.th-filters .th-filter-chip').length,
      );
    });

    it('renders the same number of filter groups as the loaded filter bar', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      expect(skeleton.querySelectorAll('.th-filters .th-filter-group')).toHaveLength(
        loaded.querySelectorAll('.th-filters .th-filter-group').length,
      );
    });

    it('uses a real table with the same column count as the loaded table', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      const loadedHeaders = loaded.querySelectorAll('.th-table thead th');
      const skeletonHeaders = skeleton.querySelectorAll('.th-table thead th');

      expect(skeletonHeaders.length).toBeGreaterThan(0);
      expect(skeletonHeaders).toHaveLength(loadedHeaders.length);
    });

    it('gives each placeholder row the same cell classes as a loaded row', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      const cellClasses = (row: Element) =>
        Array.from(row.querySelectorAll('td')).map((td) => td.className.split(' ')[0]);

      const loadedRow = loaded.querySelector('.th-table tbody .tx-row');
      const skeletonRow = skeleton.querySelector('.th-table tbody .tx-row');

      expect(loadedRow).not.toBeNull();
      expect(skeletonRow).not.toBeNull();
      expect(cellClasses(skeletonRow!)).toEqual(cellClasses(loadedRow!));
    });

    it('matches the loaded page on element type where the page CSS selects by tag', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      // `.th-filter-group label` sets a 0.7rem font-size that the date input
      // inherits. Using a <span> here left the field 2.4px too tall.
      const tag = (root: Element, sel: string) => root.querySelector(sel)?.tagName;
      expect(tag(skeleton, '.date-range-custom-field')).toBe(
        tag(loaded, '.date-range-custom-field'),
      );
    });

    it('reproduces the two-line Date and Credit Line cells that set the row height', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      const row = container.querySelector('.th-table tbody .tx-row')!;
      expect(row.querySelector('.tx-date .tx-date-main')).toBeInTheDocument();
      expect(row.querySelector('.tx-date .tx-date-sub')).toBeInTheDocument();
      expect(row.querySelector('.tx-line .tx-line-name')).toBeInTheDocument();
      expect(row.querySelector('.tx-line .tx-line-id')).toBeInTheDocument();
    });
  });

  // ── Row count ─────────────────────────────────────────────────────────────

  describe('row count', () => {
    it('defaults to one full page of rows', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      expect(TRANSACTION_SKELETON_ROWS).toBe(15);
      expect(container.querySelectorAll('.th-table tbody .tx-row')).toHaveLength(
        TRANSACTION_SKELETON_ROWS,
      );
    });

    it('matches the loaded table row count at the default row setting', () => {
      const { container: skeleton } = render(<TransactionHistorySkeleton />);
      const { container: loaded } = renderLoadedPage();

      // The mock data fills the first page, so a full-page skeleton means the
      // table container is the same height before and after the reveal.
      expect(skeleton.querySelectorAll('.th-table tbody .tx-row')).toHaveLength(
        loaded.querySelectorAll('.th-table tbody .tx-row').length,
      );
    });

    it('honours an explicit rows prop', () => {
      const { container } = render(<TransactionHistorySkeleton rows={5} />);

      expect(container.querySelectorAll('.th-table tbody .tx-row')).toHaveLength(5);
    });

    it('reserves the pagination footer by default and omits it on request', () => {
      const { container: withFooter } = render(<TransactionHistorySkeleton />);
      expect(withFooter.querySelector('.th-pagination')).toBeInTheDocument();

      const { container: withoutFooter } = render(
        <TransactionHistorySkeleton showPagination={false} />,
      );
      expect(withoutFooter.querySelector('.th-pagination')).not.toBeInTheDocument();
    });
  });

  // ── Shimmer placeholders ──────────────────────────────────────────────────

  describe('shimmer placeholders', () => {
    it('renders shimmer bars throughout the skeleton', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('never hard-codes a pixel height on a text placeholder', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      // Fixed heights are what let the old skeleton drift from the page's
      // responsive font-size overrides. Text bars must derive their height
      // from the surrounding line box instead.
      const withInlineHeight = Array.from(
        container.querySelectorAll<HTMLElement>('.th-skel-line__bar'),
      ).filter((bar) => bar.style.height !== '');

      expect(withInlineHeight).toHaveLength(0);
    });

    it('sizes each text placeholder from hidden representative text', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      const lines = container.querySelectorAll('.th-skel-line');
      expect(lines.length).toBeGreaterThan(0);

      lines.forEach((line) => {
        // Each line contributes a measurable box (the hidden text) and paints
        // a shimmer bar over it.
        expect(line.querySelector('.th-skel-line__text')).toBeInTheDocument();
        expect(line.querySelector('.th-skel-line__bar')).toBeInTheDocument();
      });
    });

    it('fills the stat icon with a radius-inheriting shimmer', () => {
      const { container } = render(<TransactionHistorySkeleton />);

      const icon = container.querySelector('.th-stat-icon')!;
      expect(icon).toHaveClass('th-skel-box');

      const fill = icon.querySelector('.th-skel-fill')!;
      // `skeleton--inherit` keeps the icon's own --radius-lg as the single
      // source of truth for the corner shape.
      expect(fill).toHaveClass('skeleton--inherit');
    });
  });

  // ── Stylesheet contract ───────────────────────────────────────────────────

  describe('stylesheet contract', () => {
    it('leaves page layout to TransactionHistory.css', () => {
      // The skeleton stylesheet must not restate the page's block geometry —
      // that duplication is the root cause of issue #854. Guard the specific
      // properties that previously drifted.
      expect(skeletonLayoutCss).not.toMatch(/grid-template-columns/);
      expect(skeletonLayoutCss).not.toMatch(/@media/);
    });

    it('declares no box metrics for the control placeholders', () => {
      // The control wrapper positions the shimmer bar and nothing else — the
      // real <select>/<input> inside it carries the padding, border, radius,
      // and font-size straight from TransactionHistory.css.
      const wrapperRule = skeletonLayoutCss.match(/\.th-skel-control\s*\{[^}]*\}/)?.[0] ?? '';
      expect(wrapperRule).toMatch(/position:\s*relative/);
      expect(wrapperRule).not.toMatch(/padding|border|font-size|height/);
    });

    it('leaves the page stylesheet untouched', () => {
      // Parity comes from reusing the page's markup, not from adding
      // skeleton-specific selectors to the page's rules.
      expect(transactionHistoryCss).not.toMatch(/th-skel/);
    });

    it('lets text placeholders wrap like the text they replace', () => {
      // Below 768px the table squeezes its columns and real cell text wraps to
      // a second line. Pinning the placeholder with `white-space: nowrap` left
      // the table ~130px short of the loaded height.
      const textRule = skeletonLayoutCss.match(/\.th-skel-line__text\s*\{[^}]*\}/)?.[0] ?? '';
      expect(textRule).toMatch(/visibility:\s*hidden/);
      expect(textRule).not.toMatch(/white-space/);
    });

    it('suppresses the page entry animation while loading', () => {
      // fadeInUp should play once, on reveal — not once for the skeleton and
      // again for the real content.
      expect(skeletonLayoutCss).toMatch(/\.th-skeleton \.th-stat-card[\s\S]*animation: none/);
    });
  });
});
