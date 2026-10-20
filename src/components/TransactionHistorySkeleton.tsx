import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { KbdHint } from './KbdHint';
/*
 * The page stylesheet is the single source of truth for this skeleton's
 * geometry (see the "Shape parity strategy" note below).  Importing it here —
 * rather than relying on TransactionHistory.tsx having imported it first —
 * keeps the component self-contained when rendered in isolation (tests,
 * Storybook-style harnesses).
 */
import '../pages/TransactionHistory.css';
import './CopyToClipboard.css';
import './AmountRangeChips.css';
import './TransactionHistorySkeleton.css';

/**
 * Number of skeleton rows that fills one page of the real table.
 * Mirrors `itemsPerPage` in `src/pages/TransactionHistory.tsx`.
 */
export const TRANSACTION_SKELETON_ROWS = 15;

/* ─────────────────────────────────────────────────────────────────────────────
 * Shape parity strategy (issue #854)
 * ───────────────────────────────────────────────────────────────────────────
 * The previous implementation re-declared the page layout with a private
 * `.th-skeleton__*` class set and hard-coded rem/px values.  That duplicate
 * layout drifted from `TransactionHistory.css` and the first paint visibly
 * jumped when the real content replaced it:
 *
 *   - the page header (`.th-header`) and export-help paragraph were missing
 *     entirely, so everything below shifted vertically on reveal;
 *   - the wrapper hard-coded `padding: 0 1.5rem 2rem` while the real page uses
 *     `padding: 0 var(--space-xl) var(--space-2xl)`, so the content shifted
 *     horizontally too;
 *   - the filter bar was a single row of four 36px bars while the real filter
 *     bar renders seven labelled groups that wrap over several rows;
 *   - the "table" was a flexbox imitation with its own breakpoints (960/640px)
 *     rather than the real table's (1400/1024/768/480/360px).
 *
 * The fix is structural rather than cosmetic: the skeleton now renders the
 * *same DOM shape with the same class names* as the loaded page, and every
 * dimension — padding, gap, border-radius, font-size, min-height, and every
 * responsive breakpoint — is inherited from `TransactionHistory.css`.  Nothing
 * about the geometry is restated here, so the two states cannot drift apart.
 *
 * Only two things are layered on top (see TransactionHistorySkeleton.css):
 *   1. the shimmer bars themselves, and
 *   2. suppression of the page's `fadeInUp` entry animation, so the fade-in
 *      plays once — when the real content arrives — instead of twice.
 * ───────────────────────────────────────────────────────────────────────────*/

interface SkeletonLineProps {
  /**
   * Representative text for this placeholder.  It is rendered with
   * `visibility: hidden` so it contributes its exact width and line box to
   * layout while painting nothing — the shimmer bar is drawn over it.
   *
   * Prefer passing the literal string the loaded page renders (labels,
   * headings, button text).  For data-dependent text pass a realistic sample
   * (e.g. `"$50,000"`), which is what the column would size to anyway.
   */
  children?: ReactNode;
  /**
   * Explicit width, used instead of `children` when no representative string
   * makes sense.  A zero-width space still establishes the line box, so the
   * height continues to match the surrounding typography exactly.
   */
  width?: string;
}

/**
 * A single line of shimmering "text" that occupies exactly the same box as the
 * text it stands in for.
 *
 * Height parity is the important part: the placeholder never declares a pixel
 * height, so it tracks the `font-size` / `line-height` of whatever element it
 * is placed inside — including the responsive font-size overrides at the
 * 480px and 360px breakpoints — with no per-breakpoint bookkeeping.
 */
function SkeletonLine({ children, width }: SkeletonLineProps) {
  return (
    <span className="th-skel-line" style={width ? { width } : undefined}>
      {/* Sizes the box; painted over by the bar below. U+200B keeps a line box
          when there is no representative string. */}
      <span className="th-skel-line__text">{children ?? '​'}</span>
      {/* `as="span"` keeps the markup valid inside phrasing content such as the
          page's <h1> and <p class="subtitle">. */}
      <Skeleton as="span" className="th-skel-line__bar" shape="rounded" />
    </span>
  );
}

/**
 * Fills a real page element (one with intrinsic dimensions of its own, such as
 * the 40 x 40px `.th-stat-icon`) with a shimmer that adopts that element's own
 * border-radius via `shape="inherit"`.
 */
function SkeletonFill() {
  return <Skeleton as="span" className="th-skel-fill" shape="inherit" />;
}

/**
 * Placeholder for a native form control.
 *
 * Browsers size `<select>` and `<input>` with their own intrinsic box rather
 * than from `line-height`, so a `<span>` dressed in the control's CSS comes out
 * 2–4px taller — enough to shift the table down by ~10px once the filter bar
 * wraps.  Rendering the real element removes the guesswork: the control
 * supplies exact metrics and a shimmer bar is painted over it.
 *
 * The element is `disabled` (not focusable, not interactive, and reported as
 * such to AT) and lives inside an `aria-hidden` subtree, so it adds no
 * keyboard stop and no accessible name.  Its author-set colours override the
 * UA's disabled palette, so it looks identical to the loaded control.
 *
 * @param stretch `true` when the loaded control is a stretched flex child and
 *                must fill its column (the filter selects and date inputs);
 *                `false` when it sits at its intrinsic width (search input).
 */
function SkeletonControl({
  children,
  stretch = true,
}: {
  children: ReactNode;
  stretch?: boolean;
}) {
  return (
    <span className={`th-skel-control${stretch ? '' : ' th-skel-control--intrinsic'}`}>
      {children}
      <Skeleton as="span" className="th-skel-control__bar" shape="rounded" />
    </span>
  );
}

interface TransactionHistorySkeletonProps {
  /**
   * Number of placeholder rows to render.  Defaults to
   * {@link TRANSACTION_SKELETON_ROWS} (15), which is the real table's page
   * size — a full first page is the common case, and matching it keeps the
   * table container the same height before and after the data lands.
   */
  rows?: number;
  /**
   * Whether to reserve space for the pagination footer.  Defaults to `true`,
   * consistent with a full page of rows implying more than one page.
   */
  showPagination?: boolean;
}

/**
 * TransactionHistorySkeleton
 *
 * First-paint placeholder for the TransactionHistory page.
 *
 * ## Layout
 * Mirrors the loaded page block for block — header + export actions, export
 * help line, four stat cards, the full filter bar, the transaction table, and
 * the pagination footer — reusing the page's own class names so the skeleton
 * and the loaded page are the same size at every breakpoint.  See the "Shape
 * parity strategy" note above.
 *
 * ## Accessibility
 * - The wrapper carries `role="status"` and `aria-busy="true"` so assistive
 *   technology announces that content is loading (WCAG 2.1 AA — SC 4.1.3
 *   Status Messages).
 * - `aria-label` names the region.
 * - Every placeholder subtree is `aria-hidden`, so AT never reads the
 *   representative sample text used to size the shimmer bars.
 * - The subtree contains no focusable elements: no buttons or links are
 *   rendered at all, and the `<select>` / `<input>` placeholders are
 *   `disabled` (SC 2.4.3, and axe's `aria-hidden-focus` rule).  It is also
 *   `pointer-events: none`, so a loading page never looks clickable.
 *
 * ## Design tokens & dark mode
 * All colour, radius, and spacing values resolve from the CSS custom
 * properties in `src/index.css` via `TransactionHistory.css`, so the skeleton
 * follows the active theme, including `[data-contrast="high"]`.
 *
 * ## Reduced motion
 * The shimmer sweep is suppressed by `Skeleton.css` under both
 * `@media (prefers-reduced-motion: reduce)` and `[data-motion="reduced"]`.
 */
export function TransactionHistorySkeleton({
  rows = TRANSACTION_SKELETON_ROWS,
  showPagination = true,
}: TransactionHistorySkeletonProps) {
  return (
    <div
      className="transaction-history-page th-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading transaction history"
    >
      {/* ── Page header ─────────────────────────────────────────────────────
          Previously absent from the skeleton; its omission was the single
          largest source of vertical shift on reveal. */}
      <div className="th-header" aria-hidden="true">
        <div>
          <h1>
            <SkeletonLine>Transaction History</SkeletonLine>
          </h1>
          <p className="subtitle">
            <SkeletonLine>Track all your credit activity</SkeletonLine>
          </p>
        </div>
        <div className="th-header-actions">
          <div className="export-actions">
            <span className="export-btn">
              <SkeletonLine width="1em" />
              <SkeletonLine>Export CSV</SkeletonLine>
            </span>
            <span className="export-btn export-btn-secondary">
              <SkeletonLine width="1em" />
              <SkeletonLine>Export PDF</SkeletonLine>
            </span>
          </div>
        </div>
      </div>

      {/* Empty on the happy path, exactly as on the loaded page — rendered so
          its (negative) top margin applies in both states. */}
      <p className="th-export-help" aria-hidden="true" />

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="th-stats" aria-hidden="true">
        {STAT_PLACEHOLDERS.map((stat) => (
          <div key={stat.label} className="th-stat-card">
            <span className="th-stat-icon th-skel-box">
              <SkeletonFill />
            </span>
            <div className="th-stat-content">
              <span className="th-stat-label">
                <SkeletonLine>{stat.label}</SkeletonLine>
              </span>
              <span className="th-stat-value">
                <SkeletonLine>{stat.value}</SkeletonLine>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────
          Mirrors all seven groups the loaded page renders.  The old skeleton
          showed a single 36px-tall row here, which under-reserved the filter
          bar by several hundred pixels once it wrapped. */}
      <div className="th-filters" aria-hidden="true">
        <FilterSelectGroup label="Credit Line" value="All Credit Lines" />

        <ChipFilterGroup label="Type" chips={['All', 'Draw', 'Repay', 'Fee', 'Interest']} />

        <ChipFilterGroup
          label="Amount"
          chips={['All Amounts', '<$100', '$100–$1,000', '>$1,000']}
        />

        <FilterSelectGroup label="Status" value="All Statuses" />

        <div className="th-filter-group th-filter-group-wide">
          <div className="th-subgroup">
            <span className="th-filter-label">
              <SkeletonLine>Presets</SkeletonLine>
            </span>
            <ChipRow chips={['This Week', 'This Month', 'All Time']} />
          </div>
          <div className="th-subgroup">
            <span className="th-filter-label">
              <SkeletonLine>Date Range</SkeletonLine>
            </span>
            <ChipRow chips={['Today', '7d', '30d', '90d', 'Custom']} />
          </div>
          {/* The page's initial `dateRange` state is "custom", so these two
              date fields are part of the first loaded paint.

              <label>, not <span>: `.th-filter-group label` sets a 0.7rem
              font-size that a <span> would not match, and the date input
              inherits it. */}
          <div className="date-range-custom-fields">
            <label className="date-range-custom-field">
              <SkeletonLine>Start date</SkeletonLine>
              <SkeletonControl>
                <input type="date" disabled aria-hidden="true" />
              </SkeletonControl>
            </label>
            <label className="date-range-custom-field">
              <SkeletonLine>End date</SkeletonLine>
              <SkeletonControl>
                <input type="date" disabled aria-hidden="true" />
              </SkeletonControl>
            </label>
          </div>
        </div>

        {/* AmountRangeChips */}
        <div className="th-filter-group th-filter-group-wide">
          <div className="amount-range-chips">
            <span className="th-filter-label">
              <SkeletonLine>Amount range</SkeletonLine>
            </span>
            <ChipRow chips={['All amounts', 'Under $5k', '$5k-$25k', '$25k+']} />
            <div className="amount-range-actions">
              <span className="amount-range-custom-trigger">
                <SkeletonLine>Custom range</SkeletonLine>
              </span>
            </div>
          </div>
        </div>

        {/* Search combobox */}
        <div className="th-search-group">
          <div className="th-search-label-row">
            <span className="th-filter-label">
              <SkeletonLine>Search</SkeletonLine>
            </span>
            {/* Static chrome — rendered for real so the shortcut row reserves
                exactly the height it will occupy once loaded. */}
            <div className="th-search-shortcuts">
              <KbdHint keys={['↑', '↓']} label="Navigate" />
              <KbdHint keys="Enter" label="Select" />
              <KbdHint keys="Esc" label="Close" />
            </div>
          </div>
          <div className="th-search-combobox">
            <SkeletonControl stretch={false}>
              <input
                type="text"
                placeholder="Search by note, line, ID, or hash…"
                disabled
                aria-hidden="true"
              />
            </SkeletonControl>
          </div>
        </div>

        <div className="th-filter-results">
          <SkeletonLine>28 transactions shown</SkeletonLine>
        </div>
      </div>

      {/* ── Transaction table ───────────────────────────────────────────────
          A real <table class="th-table"> so column sizing, header padding, row
          padding, and the horizontal-scroll behaviour below 768px all come
          from the page stylesheet instead of a flexbox approximation. */}
      <div className="th-table-container" aria-hidden="true">
        <table className="th-table">
          <thead>
            <tr>
              {TABLE_HEADINGS.map((heading) => (
                <th key={heading}>
                  <SkeletonLine>{heading}</SkeletonLine>
                </th>
              ))}
              {/* Empty expand column, matching the loaded table. */}
              <th />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, index) => (
              <SkeletonRow key={index} index={index} />
            ))}
          </tbody>
        </table>

        {showPagination && (
          <div className="th-pagination">
            <span className="th-page-btn">
              <SkeletonLine>Previous</SkeletonLine>
            </span>
            <span className="th-page-info">
              <SkeletonLine>Page 1 of 2</SkeletonLine>
            </span>
            <span className="th-page-btn">
              <SkeletonLine>Next</SkeletonLine>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Placeholder content ─────────────────────────────────────────────────────
 * Representative strings, not real data.  They are never visible (the shimmer
 * bar covers them) and never announced (the whole subtree is aria-hidden);
 * their only job is to reproduce the widths the loaded page will size to. */

const TABLE_HEADINGS = ['Date', 'Type', 'Amount', 'Credit Line', 'Status', 'Hash'] as const;

const STAT_PLACEHOLDERS = [
  { label: 'Total Drawn', value: '$450,000' },
  { label: 'Total Repaid', value: '$85,500' },
  { label: 'Total Interest', value: '$4,811' },
  { label: 'Current Debt', value: '$368,689' },
] as const;

/**
 * Sample cell content, cycled by row index so renders stay stable.
 *
 * The strings are drawn from `src/data/mockData.ts` rather than invented,
 * because below 768px the table squeezes its columns and cell text starts to
 * wrap — which is what actually sets the row height there.
 *
 * The Credit Line name is the only cell that wraps at those widths: names up to
 * about 21 characters stay on one line (39px row) and longer ones take two
 * (~58px row). Roughly half the rows in the data set fall on each side, so the
 * cycle alternates two short names and two long ones. Row height below 768px is
 * ultimately data-dependent and no static skeleton can predict it exactly; this
 * mix keeps the placeholder table the right height for a representative page.
 */
const ROW_SAMPLES = [
  {
    date: 'Feb 18, 2025',
    time: '10:30 AM',
    type: 'Draw',
    amount: '+$50,000',
    // 21 characters — stays on one line.
    line: 'Primary Business Line',
    lineId: 'CL-2024-001',
    status: 'Completed',
  },
  {
    date: 'Feb 10, 2025',
    time: '02:15 PM',
    type: 'Repayment',
    amount: '-$12,500',
    // 21 characters — stays on one line.
    line: 'Revolving Credit Line',
    lineId: 'CL-2025-006',
    status: 'Pending',
  },
  {
    date: 'Feb 1, 2025',
    time: '09:45 AM',
    type: 'Interest',
    amount: '$1,328',
    // 22 characters — wraps to two lines below 768px.
    line: 'Expansion Capital Line',
    lineId: 'CL-2024-002',
    status: 'Completed',
  },
  {
    date: 'Jan 15, 2025',
    time: '04:00 PM',
    type: 'Fee',
    amount: '-$750',
    // 24 characters — wraps to two lines below 768px.
    line: 'Working Capital Facility',
    lineId: 'CL-2023-003',
    status: 'Failed',
  },
] as const;

/**
 * A single placeholder table row.
 *
 * Uses the real `tx-*` cell classes, so the `min-width` anchors (`.tx-date`,
 * `.tx-amount`, `.tx-status`, `.tx-hash`, `.tx-expand`) and the row's vertical
 * padding are identical to a loaded row.  The two-line Date and Credit Line
 * cells are reproduced because they, not the single-line cells, determine the
 * row height.
 */
function SkeletonRow({ index }: { index: number }) {
  const sample = ROW_SAMPLES[index % ROW_SAMPLES.length];

  return (
    <tr className="tx-row">
      <td className="tx-date">
        <div className="tx-date-main">
          <SkeletonLine>{sample.date}</SkeletonLine>
        </div>
        <div className="tx-date-sub">
          <SkeletonLine>{sample.time}</SkeletonLine>
        </div>
      </td>
      <td className="tx-type">
        <span className="tx-type-badge">
          <SkeletonLine width="1em" />
          <SkeletonLine>{sample.type}</SkeletonLine>
        </span>
      </td>
      <td className="tx-amount num-tabular">
        <SkeletonLine>{sample.amount}</SkeletonLine>
      </td>
      <td className="tx-line">
        <span className="tx-line-name">
          <SkeletonLine>{sample.line}</SkeletonLine>
        </span>
        <span className="tx-line-id">
          <SkeletonLine>{sample.lineId}</SkeletonLine>
        </span>
      </td>
      <td className="tx-status">
        <span className="tx-status-badge">
          <SkeletonLine>{sample.status}</SkeletonLine>
        </span>
      </td>
      <td className="tx-hash">
        <div className="tx-hash-actions">
          <span className="tx-hash-link">
            <SkeletonLine>0xabc123...def456</SkeletonLine>
          </span>
          {/* Mirrors the CopyToClipboard affordance, whose 32px min-height
              contributes to the row height. */}
          <span className="copy-affordance">
            <span className="copy-affordance__button">
              <SkeletonLine>Copy</SkeletonLine>
            </span>
          </span>
        </div>
      </td>
      <td className="tx-expand">
        <span className="expand-icon">
          <SkeletonLine width="0.7em" />
        </span>
      </td>
    </tr>
  );
}

/* ── Filter-group helpers ──────────────────────────────────────────────────*/

/** A labelled `<select>` filter group (Credit Line, Status). */
function FilterSelectGroup({ label, value }: { label: string; value: string }) {
  return (
    <div className="th-filter-group">
      <span className="th-filter-label">
        <SkeletonLine>{label}</SkeletonLine>
      </span>
      <SkeletonControl>
        <select disabled aria-hidden="true">
          <option>{value}</option>
        </select>
      </SkeletonControl>
    </div>
  );
}

/** A labelled chip toggle group (Type, Amount). */
function ChipFilterGroup({ label, chips }: { label: string; chips: readonly string[] }) {
  return (
    <div className="th-filter-group th-filter-group-wide">
      <span className="th-filter-label">
        <SkeletonLine>{label}</SkeletonLine>
      </span>
      <ChipRow chips={chips} />
    </div>
  );
}

/** The chip row itself, without a label. */
function ChipRow({ chips }: { chips: readonly string[] }) {
  return (
    <div className="th-chip-group">
      {chips.map((chip) => (
        <span key={chip} className="th-filter-chip">
          <SkeletonLine>{chip}</SkeletonLine>
        </span>
      ))}
    </div>
  );
}
