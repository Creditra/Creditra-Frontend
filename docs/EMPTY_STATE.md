# Empty states

The shared `<EmptyState />` component (`src/components/EmptyState.tsx`)
centralises how the product shows "nothing here yet" moments.

## Component

```tsx
<EmptyState
  tone="success"                 // 'info' | 'success'
  eyebrow="All caught up"        // optional muted uppercase line
  illustration={<NoOutstandingDebt />} // decorative SVG (aria-hidden inside)
  title="Nothing to repay right now"   // accessible name
  description="You don't have any active credit lines with an outstanding balance."
  primaryAction={{ label: 'Request a credit line', to: '/open-credit' }}
  secondaryAction={{ label: 'Back to dashboard', to: '/' }}
/>
```

### Behaviour notes

- The root region uses `role="status"` + `aria-live="polite"` so screen
  readers announce the heading + description when the empty state appears
  after navigation. It never interrupts the user.
- The heading id is auto-generated with `React.useId()`; consumers can
  override via `titleId` when nesting inside a labelled region.
- Primary and secondary actions may each be either a React Router
  `<Link>` (preferred — pass `to`) or a `<button>` (pass `onClick`).
- The illustration is purely decorative and stays out of the accessibility
  tree; the heading is the accessible name.
- `...rest` spreads onto the root `<div>`, so any standard HTML attribute
  (e.g. `data-testid`) is accepted.

## Illustrations

Located in `src/components/illustrations/EmptyStateIllustrations.tsx`,
each illustration is an inline SVG that uses `currentColor` so it inherits
whatever foreground colour the surrounding tone sets.

| Illustration       | Use it when…                                         |
| ------------------ | ---------------------------------------------------- |
| `NoLines`          | The user has zero credit lines                       |
| `NoActivity`       | The user has credit lines but no transactions yet   |
| `NoDataGraph`      | Filters narrow transactions to zero results          |
| `NoOutstandingDebt`| The user has nothing to repay (issue #581, Repay)    |
| `NoRiskGauge`      | No risk score data available yet (issue #694)        |
| `NoOverdue`        | No credit lines are past due (GrantFox FWC26)        |

Add new illustrations next to these. Keep all SVGs `currentColor`-only
so they theme through transparent token inheritance.

## Adopters

- **`AgingTagPage`** (`src/pages/AgingTag.tsx`) — shows the `NoOverdue`
  illustration with a success-tone empty state when no credit lines are
  past due (GrantFox FWC26). The CTAs point to `/credit-lines` (view lines)
  and `/` (dashboard). When delinquent lines exist, the page renders a
  summary list with `AgingTag` badges and a "Repay Now" link per line.
- **`RepayPage`** (`src/pages/RepayPage.tsx`) — replaces the bare fallback
  paragraph with the themed empty state when no credit line has
  `status === 'Active' && utilized > 0`. The CTAs point to `/open-credit`
  (request a new line) and `/` (dashboard).
- **`TransactionHistory`** — historically hand-rolled the same DOM with
  inline classes; consumer regression tests in
  `src/pages/TransactionHistory.test.tsx` still pass with the local
  styling. Migration to the shared component is a separate task.
- **`CreditLines`** — same history; same future migration note.
- **`Dashboard`** (`src/pages/Dashboard.tsx`) — replaces the raw dashboard
  grid with the shared empty state when the wallet has zero credit lines
  (`status === 'success' && !hasLines`). Uses `NoLines`, matching the
  illustration convention used by `CreditLines` and `TransactionHistory`
  for the same "zero credit lines" condition. The CTA links to
  `/open-credit` (issue #561).

## Theming / a11y contract

- All colours come from `src/index.css` CSS custom properties
  (`--accent`, `--bg`, `--text`, `--muted`, `--success`, `--border`).
  No hex literals inside `EmptyState.css`.
- The high-contrast theme (`[data-contrast="high"]`) bumps outlines and
  borders.
- Reduced motion (`@media (prefers-reduced-motion: reduce)`) removes the
  CTA hover lift.
- Tone variants never rely on colour alone to convey meaning — the
  heading + illustration always carry the message (WCAG 1.4.1).

## Tests

- `src/components/__tests__/EmptyState.test.tsx` — API contract: required
  props, eyebrow, link vs button actions, tone class, accessibility defaults.
- `src/components/__tests__/NoOutstandingDebt.test.tsx` — illustration
  smoke tests (decorative aria-hidden, no focusable nodes, currentColor
  inheritance, className pass-through).
- `src/pages/__tests__/RepayPage.empty.test.tsx` — RepayPage empty-state
  render path (separate file to avoid mock isolation with the populated
  suite in `RepayPage.test.tsx`).
- `src/pages/__tests__/AgingTag.emptyState.test.tsx` — AgingTagPage empty
  state and populated-path tests (12 tests).
