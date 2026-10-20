# TransactionHistory — First-Paint Loading Skeleton

Themed shimmer placeholder shown on the first paint of the `/transactions` route while
transaction data is being resolved.

---

## Why this exists

Navigating to `/transactions` used to cause a brief flash of unstyled content (FOUC): the
full filter bar, stats cards, and table were committed to the DOM in one shot after data
became available, producing a visual pop. The skeleton replaces that pop with a stable,
themed layout that occupies the same space as the eventual content.

---

## Shape parity (issue #854)

The first version of the skeleton re-declared the page layout with a private
`.th-skeleton__*` class set and hard-coded rem values. That duplicate layout drifted from
`TransactionHistory.css`, so the first paint still jumped noticeably on reveal:

- the page header (`.th-header`) and the export-help paragraph were missing entirely, so
  everything below shifted vertically;
- the wrapper hard-coded `padding: 0 1.5rem 2rem` instead of the page's
  `padding: 0 var(--space-xl) var(--space-2xl)`;
- the filter bar was a single row of four 36px bars, while the loaded filter bar renders
  seven labelled groups that wrap over several rows;
- the "table" was a flexbox imitation with its own breakpoints (960/640px) rather than the
  real table's (1400/1024/768/480/360px);
- the default row count was 8 against a page size of 15.

Measured in Chromium against the loaded page, the skeleton was **155–742px shorter** than
the content it stood in for, placing the stats row 45–139px and the table 117–509px too
high:

| Viewport | Document height Δ | Stats row Δ | Table Δ |
|---|---|---|---|
| 1440px | −155px | −45px | −174px |
| 1200px | −188px | −45px | −205px |
| 900px | −183px | −45px | −117px |
| 700px | −668px | −89px | −473px |
| 480px | −742px | −139px | −509px |
| 360px | −686px | −132px | −460px |

### The fix

The skeleton now renders **the same DOM shape with the same class names as the loaded
page** — `.transaction-history-page`, `.th-header`, `.th-stats`, `.th-stat-card`,
`.th-filters`, a real `<table class="th-table">` with `<tr class="tx-row">`, and the
pagination footer. Every dimension (padding, gap, border-radius, font-size, min-height,
and every responsive breakpoint) is inherited from `TransactionHistory.css`. No geometry is
restated in the skeleton, so the two states cannot drift apart.

After the change, all six viewports measure a **0px** delta on document height, stats row
position, filter bar height, table container height, and row height.

Three techniques make that possible:

1. **Text placeholders are sized by hidden text.** `.th-skel-line` wraps the string the
   loaded page renders (or a representative sample for data-driven cells) with
   `visibility: hidden`, and paints the shimmer bar over it. The placeholder therefore
   inherits the exact width and line box of the text it replaces, including the responsive
   font-size overrides at 480px and 360px — no per-breakpoint pixel heights to maintain.
   The hidden text is allowed to **wrap**, because below 768px the table squeezes its
   columns and real cell text breaks onto a second line.
2. **Form controls are the real elements.** Browsers size `<select>` and `<input>` from
   their own intrinsic box rather than from `line-height`, so a `<span>` dressed in the
   control's CSS came out 2–4px taller — compounding into a ~10px shift once the filter bar
   wrapped. The skeleton renders the actual elements, `disabled` and inside the
   `aria-hidden` subtree, with a shimmer bar painted over each.
3. **Box placeholders inherit their host's radius.** `Skeleton` gained
   `shape="inherit"` (`border-radius: inherit`) so a shimmer filling `.th-stat-icon` picks
   up that element's `--radius-lg` instead of restating it.

### Known limitation

Below 768px the transaction table scrolls horizontally and cell text wraps, so row height
depends on the actual data — a static skeleton cannot predict it exactly. `ROW_SAMPLES` in
`TransactionHistorySkeleton.tsx` cycles two short and two long credit-line names, matching
the roughly even split in the current data set. If credit-line naming changes
substantially, revisit that mix.

---

## Components involved

| File | Role |
|---|---|
| `src/components/TransactionHistorySkeleton.tsx` | Page-level skeleton. Mirrors the loaded page's DOM and class names; supplies representative sample strings. |
| `src/components/TransactionHistorySkeleton.css` | Shimmer layer only — text/box/control placeholders and entry-animation suppression. Contains **no** page layout and no media queries. |
| `src/components/Skeleton.tsx` | Shimmer primitive. Gained `shape="inherit"` and an `as` prop (issue #854). |
| `src/pages/TransactionHistory.tsx` | Owns `isLoading`; renders `<TransactionHistorySkeleton rows={ITEMS_PER_PAGE} />` before any other early-return guard. |
| `src/pages/TransactionHistory.css` | The single source of truth for the geometry of **both** states. Unchanged by this work. |

---

## How the loading state works

```ts
// TransactionHistory.tsx (simplified)
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  // Clears on the first committed render, simulating async data resolution.
  // Replace with the real fetch-completion signal when the API is wired up.
  const id = setTimeout(() => setIsLoading(false), 0);
  return () => clearTimeout(id);
}, []);

if (isLoading) return <TransactionHistorySkeleton rows={ITEMS_PER_PAGE} />;
```

`setTimeout(0)` yields control back to the browser for one frame so the skeleton is
painted before the heavy filter/table tree is committed. When real data fetching is added,
replace `setTimeout` with the async resolution point (e.g. set `isLoading = false` in the
`.then()` / `await` of the fetch call).

---

## TransactionHistorySkeleton API

```tsx
<TransactionHistorySkeleton rows={15} showPagination />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `rows` | `number` | `TRANSACTION_SKELETON_ROWS` (15) | Number of shimmer transaction rows. Defaults to the real table's page size so the container does not resize on reveal. |
| `showPagination` | `boolean` | `true` | Reserves the pagination footer. A full page of rows implies more than one page. |

`TRANSACTION_SKELETON_ROWS` is exported for callers that need to reason about the count.

---

## Accessibility

- The wrapper has `role="status"` and `aria-busy="true"` so assistive technology announces
  that content is loading (WCAG 2.1 AA — SC 4.1.3 Status Messages).
- `aria-label="Loading transaction history"` names the region.
- Every placeholder block carries `aria-hidden="true"`, so screen readers never narrate the
  representative sample strings used to size the shimmer bars.
- The `<select>` / `<input>` placeholders are `disabled`, so the `aria-hidden` subtree
  contains no focusable elements (SC 2.4.3, and axe's `aria-hidden-focus` rule). The whole
  subtree is also `pointer-events: none`, so nothing in a loading page looks clickable.
- The shimmer sweep is suppressed under `@media (prefers-reduced-motion: reduce)` and the
  `[data-motion="reduced"]` hook (both in `Skeleton.css`).
- The page's `fadeInUp` entry animation is suppressed while loading so it plays once, on
  reveal, instead of twice.

---

## Design-token contract

The skeleton declares no colours of its own. Everything resolves through
`TransactionHistory.css` and `Skeleton.css`:

| Property | Token |
|---|---|
| Card / container backgrounds | `var(--surface)` |
| Page background (thead) | `var(--bg)` |
| Borders | `var(--border)` |
| Shimmer base colour | `var(--skeleton-bg)` → `var(--border)` |
| Corner radii | inherited from the mirrored element |

The skeleton therefore follows the active theme automatically, including
`[data-contrast="high"]` high-contrast mode.

---

## Responsive behaviour

The skeleton has **no breakpoints of its own**. It responds at exactly the page's
breakpoints (1400 / 1024 / 768 / 480 / 360px) because it is laid out by the page's rules.
Adding a media query to `TransactionHistorySkeleton.css` would reintroduce the drift this
change removed, and a test asserts the file contains none.

---

## Tests

| File | What it covers |
|---|---|
| `src/components/TransactionHistorySkeleton.test.tsx` | ARIA attributes; no focusable elements; structural parity against the rendered loaded page (class names, stat cards, filter groups, filter chips, table columns, row cell classes, element types); row count vs. page size; shimmer placeholders declare no fixed heights; stylesheet contract (no layout, no media queries, no page-CSS edits). |
| `src/components/Skeleton.test.tsx` | `shape="inherit"` modifier; `as="span"` rendering and valid nesting inside phrasing content. |
| `src/pages/TransactionHistory.test.tsx` (Loading skeleton `describe`) | Skeleton visible on first paint; table and controls absent from the accessibility tree while loading; full page of rows reserved; header reserved; page wrapper class adopted; transition to the loaded state. |

jsdom does not apply stylesheets, so the tests cannot measure pixels. They instead assert
the property that *produces* matching pixels — that the skeleton and the loaded page render
the same structure and are laid out by the same rules. The pixel measurements quoted above
were taken in Chromium via a temporary harness.

---

## Migrating to real async data

When the backend API is wired up:

1. Remove the `setTimeout` in the `useEffect`.
2. Set `isLoading = false` after your `await fetch(...)` / `useQuery` resolves.
3. Propagate a loading prop down from the data hook if you use a data-fetching library.

The skeleton component itself requires no changes — it is entirely presentation.
