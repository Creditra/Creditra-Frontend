# Accessibility

Creditra commits to **WCAG 2.1 AA** conformance, with selected 2.2 AAA criteria (target
size 44 px) adopted as defaults. This document is both the policy and the implementation
reference.

The frontend is reviewed for accessibility on every PR. The checklist in the root README
is the bare minimum; the per-pattern guidance below is how individual components are
expected to behave.

---

### Command palette (Cmd/Ctrl+K)

Global keyboard navigation overlay (`src/components/CommandPalette.tsx`):

- **Open:** `Cmd/Ctrl+K` anywhere, or the header **Search ⌘K** button
- **Navigate:** Arrow keys; **Enter** activates; **Esc** closes and restores focus
- Uses `useFocusTrap`, `useBodyScrollLock`, and `useInertBackdrop` (same modal contract)
- Default registry covers Dashboard, Transactions, Credit Lines, Repay, Draw, Linked Accounts, Help, and notification preferences

---

## 1. Why AA, not A or AAA

- **AA is the legal baseline** under most public-procurement, EU, and US accessibility
  regulations. Anything less is a future liability.
- **AAA is component-by-component achievable**, not platform-wide — for example, AAA
  contrast (7:1) breaks data-density on the Transactions table without an alternate view.
  We hold the line at AA but cherry-pick AAA where it costs nothing (target size, focus
  rings).
- **The protocol handles money.** A user who cannot reliably operate the repay flow is a
  user we have actively harmed. Accessibility is not a marketing checkbox here.

The four POUR principles drive every decision:

1. **Perceivable** — every signal has a non-color form (glyph, text, ARIA).
2. **Operable** — every action is keyboard-reachable in a logical order.
3. **Understandable** — errors are inline, specific, and recoverable.
4. **Robust** — semantic HTML first; ARIA only when no native element fits.

---

## 2. Per-pattern guidance

### Modals and sheets

Every modal **must** compose all three a11y hooks:

| Hook | File | Role |
| --- | --- | --- |
| `useFocusTrap` | `src/hooks/useFocusTrap.ts` | Tab/Shift+Tab cycling, Escape close, return-focus to trigger |
| `useBodyScrollLock` | `src/hooks/useBodyScrollLock.ts` | Freeze background scroll, preserve scroll position |
| `useInertBackdrop` | `src/hooks/useInertBackdrop.ts` | `inert` (or `aria-hidden` fallback) on everything outside the modal |

The canonical example is `src/components/WalletConnectionModal.tsx`. The modal container
also sets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the
heading.

### Tables (Transactions, Credit Lines)

- Column headers are `<th scope="col">` with a `<button>` child for sortable columns;
  pressing Enter/Space toggles sort.
- `aria-sort="ascending|descending|none"` is set on the active column header.
- Row order is the visual order; no reordering of DOM relative to layout.
- Filter chips are styled `<button>`s with `aria-pressed` reflecting the toggle state.
- Notification filters use the WAI-ARIA tab pattern: the group has `role="tablist"`,
  each filter has `role="tab"`, the active filter sets `aria-selected="true"`, and
  Arrow/Home/End keys move focus and selection.

### Tabs

Use the shared controlled `Tabs` component (`src/components/Tabs.tsx`) for tabbed
interfaces. It exposes `role="tablist"`, `role="tab"`, and `role="tabpanel"`, links tabs
to their panels with `aria-controls` and `aria-labelledby`, and implements roving focus.
Arrow Left/Right wraps through enabled tabs; Home/End selects the first/last enabled tab.
Consumers provide `tabs`, `activeTab`, `onTabChange`, and a descriptive `ariaLabel`.

### Forms

- Every input is wrapped by `<FormField>` (`src/components/FormField.tsx`) which
  programmatically wires `htmlFor` ↔ `id`, sets `aria-describedby` to a space-separated
  list of help + error IDs, sets `aria-invalid` on error, and emits `aria-required` when
  marked required.
- Error messages are rendered through `<FormMessage>`. The visible message updates
  immediately, while the live alert announcement is debounced by 300 ms so assistive
  technology hears the settled validation state instead of every intermediate keystroke.
- Inline validation does not block typing; it transitions the message tone from `info` →
  `success`/`warning`/`danger` per `getDrawAmountValidation` in
  `src/utils/amountValidation.ts`.
- Submit buttons use `<PendingButton>` so `aria-busy="true"` is set during the request
  and the label changes (`Submit` → `Submitting…`) to communicate state.

### Menus and dropdowns

- Trigger has `aria-haspopup="true"`, `aria-expanded={open}`, and an `aria-label`
  describing what opens.
- Menu items use `role="menuitem"`.
- Escape closes; click-outside closes; focus returns to the trigger.
- Example: `WalletButton.tsx` connected state — `aria-haspopup` and `aria-expanded` on the
  address chip, `role="menu"` on the dropdown.

### Search combobox (TransactionHistory)

The search field on the Transaction History page follows the **ARIA 1.2 combobox pattern**
(single-select, list autocomplete). Implementation is in `src/pages/TransactionHistory.tsx`.

| Attribute | Element | Value / purpose |
| --- | --- | --- |
| `role="combobox"` | `<input>` | Signals combined text-entry + popup to AT |
| `aria-expanded` | `<input>` | `"true"` when suggestion listbox is visible |
| `aria-controls` | `<input>` | ID of the `role="listbox"` element |
| `aria-autocomplete="list"` | `<input>` | Completions appear in popup, not inline |
| `aria-activedescendant` | `<input>` | ID of the currently keyboard-focused option |
| `role="listbox"` | `<ul>` | Suggestion container |
| `role="option"` | `<li>` | Individual suggestion |
| `aria-selected` | `<li>` | `"true"` on the active (keyboard-navigated) option |
| `aria-label="Clear search"` | `<button>` | ✕ clear button visible only when input is non-empty |

Keyboard interaction:

| Key | Behaviour |
| --- | --- |
| Arrow Down | Open list (if closed); move active option down (wraps) |
| Arrow Up | Move active option up (wraps) |
| Enter | Commit active option; if none active, close list |
| Escape | Dismiss list, keep typed value |
| Tab | Dismiss list, advance focus |

Filtering is debounced (250 ms) to prevent layout thrashing on every keystroke; the raw
input value drives the visible suggestion list immediately. The committed search query
joins the existing AND-filter chain (type × date × amount × credit-line × status × search).

`prefers-reduced-motion`: the listbox slide-in animation is suppressed via a
`@media (prefers-reduced-motion: reduce)` block in `TransactionHistory.css`.### Status badges and gauges

- `StatusBadge` pairs a tinted pill with a single-letter glyph (`A | ! | X | C`). Color is never the sole signal.
- Risk gauge uses `<text>` SVG nodes for the score and a separate `<text>` for the trend arrow (`▲ | ▼ | ─`) plus the trend word as a sibling element so screen readers don't miss it.

### Pattern fills beyond colour (Dashboard v7, #565)

Visual colour-coding on the Dashboard is supplemented with shape-coded pattern
fills so the identity of a status indicator survives any colour filter
(protanopia / deuteranopia / tritanopia / monochrome printing / forced colours).

The pattern taxonomy lives in `src/styles/patterns.css`. Six shape families are
in use, each mapped 1:1 to a semantic meaning:

| Shape family       | Map                                                | Source pattern                             |
| ---                | ---                                                | ---                                        |
| Dots               | `summary-card--accent`, util-low indicator         | `radial-gradient(circle, …)`              |
| 45° stripes        | `util-fill--medium`, `status-suspended`,           | `linear-gradient(45deg, …)`                |
|                    | `notification-item--warning`, util-summary         |                                           |
| 135° stripes       | `status-frozen`                                    | `linear-gradient(135deg, …)`               |
| Cross-hatch (v7)   | `util-fill--high`, `notification-item--danger`     | two `repeating-linear-gradient`s           |
| Chevron (v7)       | `summary-card--available`, util-low chevron        | `linear-gradient(0deg, …)` w/ upper cap    |
| Horizontal lines   | `status-closed`, `notification-item--info`         | `repeating-linear-gradient(0deg, …)`       |
| Dense 45°          | `status-defaulted`                                 | `repeating-linear-gradient(45deg, …)`      |

Each Dashboard status indicator carries a modifier class so the pattern is
applied without touching colour:

| Indicator                        | Modifier class                         | Pattern reached via                                                                |
| ---                              | ---                                    | ---                                                                                |
| Summary card — Total Limit       | `summary-card--accent`                 | `.summary-card::before` radial dot stripe on the left edge of the card             |
| Summary card — Total Utilized    | `summary-card--util-{low\|medium\|high}` | Pattern echoes the matching util-fill level on the left-edge stripe              |
| Summary card — Available Credit  | `summary-card--available`              | Upward chevron + horizontal line mix on the left edge                              |
| Util-bar fill (Credit Summary)   | `util-fill--{low\|medium\|high}`        | `.util-bar-fill::before` overlay on top of the inline-coloured fill                |
| Per-line util mini-bar           | `util-fill--{low\|medium\|high}`        | `.cl-preview-bar-fill::before` overlay; matches the headline bar                   |
| Notification severity            | `notification-item--{info\|warning\|danger}` | `.notification-item` background-image overlay; left border + base tint preserved |
| Risk-gauge band                  | `data-tier="strong\|fair\|below"`      | Glyph (▲ ◆ ●) rendered next to the score; colour supplied by `RISK_COLOR(score)`    |
| Status badge (existing)          | `status-{status.toLowerCase()}`        | Existing single-letter `A\|!\|X\|C\|F` glyph + bg pattern                           |

**Accessibility:**

- Pattern opacity is 0.16–0.55 over the existing colour fill — verified to
  preserve WCAG 2.1 AA contrast for foreground text and borders.
- Reachability is unchanged: every indicator keeps its existing ARIA labels
  (`aria-label`, `role="alert"` on `notification-item--danger`,
  `aria-labelledby` on the gauge SVG, `aria-label` on `StatusBadge`).
- High-contrast mode (`[data-contrast="high"]`) bumps opacities by ~0.25 so
  patterns remain perceivable against the pure-black background.
- Forced-colours mode (`@media (forced-colors: active)`) suppresses all
  patterns and relies on the host OS colour palette plus component glyphs,
  preventing the OS palette from clashing with our rgba overlays.

**Responsive:** At <=768px the activity icons and QA tiles (28–36 px) keep
their emoji glyphs but receive no pattern overlay — at those small sizes a
12×12 pattern tile renders as a muddy blur. Emoji glyphs satisfy WCAG 1.4.1
on their own.

**Authoring new statuses:** add the new status to `STATUS_COLOR` in
`src/utils/tokens.ts` (existing colour blend) and append a matching block to
`src/styles/patterns.css` using a shape family that is *not already in use*
on the same surface, then add the modifier class to the indicator's
className in `Dashboard.tsx`.

### Transaction-status icon patterns (DrawCreditPage — FWC26)

Step 4 of the draw-credit wizard renders `TransactionStatus` whose outcome circle uses
**both** a color-tint class (`.dc-status-icon-bg--{accent|success|error}`) **and** a
pattern-fill class (`.dc-status-icon-bg--pattern-{pending|success|error}` from
`src/styles/patterns.css`).

| Status | Color token | Pattern geometry | CSS class |
| --- | --- | --- | --- |
| pending | `--accent` (blue) | Concentric dots | `.dc-status-icon-bg--pattern-pending` |
| success | `--success` (green) | Diagonal stripes 45° | `.dc-status-icon-bg--pattern-success` |
| error | `--error` (red) | Crosshatch 45°+135° | `.dc-status-icon-bg--pattern-error` |

The three geometries remain visually distinct even when all colours collapse to the same
system colour in forced-colours (Windows High Contrast) mode.  A `@media (forced-colors:
active)` block in `patterns.css` replaces the `color-mix()` fill with `CanvasText` so
the stripes and dots remain visible.

In addition to the pattern, the outcome heading ("Draw Successful", "Draw Failed",
"Processing") and the `data-status` attribute on the icon circle provide text-level
identification independent of both color and pattern.

### Chart captions and SR-friendly table siblings

Both `RepaymentVisualizer` and `RiskGauge` expose accessible descriptions at two levels:

**Chart series patterns (RepaymentVisualizer)** — principal remaining and cumulative
interest are distinguished by hatch direction (45° vs 135°) layered on the area
gradients, with matching patterned legend swatches in `src/styles/patterns.css`
(WCAG 1.4.1 — colour is not the only visual means of identification).

**SVG-level label** — the `aria-label` / `aria-labelledby` on the `<svg role="img">` element
is the first thing screen readers announce when the user focuses the chart.  Both components
accept an optional prop to override the default description with a more specific one.

**SR-only data table sibling** — a visually-hidden `<table className="sr-only">` is rendered
adjacent to each chart so users who prefer table navigation get full data access without
interacting with SVG arcs:

| Component | SR table contents | Key attributes |
| --- | --- | --- |
| `RepaymentVisualizer` | Month-by-month principal/interest breakdown | `<caption>` auto-generated from term length + total interest; overridable via `caption` prop; `KbdHint` keyboard navigation (`←`/`→`/`Home`/`End`/`Esc`) |
| `RiskGauge` | Three risk bands (High/Medium/Low) with score ranges | `aria-current="true"` on the row for the active band; rendered before the SVG so it appears first in reading order |

These tables are always present in the accessibility tree (no `aria-hidden`) and follow
the standard `<caption>` + `<th scope="col">` + `<td>` pattern.

### Keyboard shortcut hints (`KbdHint`)

The `KbdHint` component (`src/components/KbdHint.tsx`) provides standardized visual and screen-reader accessible keyboard shortcut hints.

- Renders semantic `<kbd>` elements styled with design tokens (`var(--surface-raised)`, `var(--border)`, `var(--text)`).
- Provides screen-reader accessible text via `.sr-only` element describing the shortcut action.
- `RepaymentVisualizer` embeds `KbdHint` to indicate keyboard controls for chart inspection:
  - `←` / `→`: Step backward / forward through schedule months
  - `Home` / `End`: Jump to first / last repayment month
  - `Esc`: Clear active data point inspection


### Live regions

| Use | Politeness | Component |
| --- | --- | --- |
| Form field errors | `role="alert"` (assertive, debounced 300 ms) | `FormMessage` |
| Copy-to-clipboard success | `aria-live="polite"` | `CopyToClipboard` |
| Route changes | `role="status" aria-live="polite"` | `RouteAnnouncer` |
| Transaction filter result count | `role="status" aria-live="polite" aria-atomic="true"` | `TransactionHistory` filter bar |
| Browser connectivity (header) | Assertive on offline; polite on restore | `NetworkStatus` |
| Post-action confirmation | `role="status" aria-live="polite"` | `SuccessState` |
| Toast notifications | Polite `ToastContainer` live region for confirmations; individual error toasts escalate to `role="alert"` | `ToastContainer` |

### Focus management

- Global `:focus-visible` rule in `src/index.css` is `outline: 2px solid var(--accent); outline-offset: 2px`.
- Shared focus tokens and page-scoped rings live in `src/styles/focus.css`
  (`--focus-ring-color`, `--focus-ring-width`, `--focus-ring-offset`). High
  contrast overrides `--focus-ring-color` to `#ffffff` under
  `[data-contrast="high"]`.
- `DrawCreditPage` (FWC26 / issue #592) scopes keyboard-only rings under
  `.dc-page` for credit-line cards, `.dc-btn` / `.dc-preset-btn`, the terms
  checkbox, the sticky summary bar, and AmountInput stepper / Max / preset
  controls. The footer "Contact support" control uses the shared `.focus-ring`
  utility. Rings use `:focus-visible` so pointer clicks stay clean.
- `RepaymentVisualizer` applies `.repayment-visualizer-focus` to its interactive
  chart, schedule disclosure, and row-expansion control. The class uses shared
  focus tokens and `:focus-visible`, so keyboard users receive a consistent
  outline without adding a focus ring on pointer clicks.
- `RepaymentVisualizer` first-paint loading (issue #609) uses
  `RepaymentVisualizerSkeleton` with `role="status"` / `aria-busy="true"` so
  assistive technology hears the loading state before the chart commits.
- Active nav links keep focus styling distinct from active styling (see the comment block
  around `.header-nav-link.active` in `src/index.css`).
- Modal close returns focus to the trigger via `useFocusTrap`'s `triggerRef`.

### Anchor/sidebar nav (HelpCenter)

`HelpCenter.tsx` uses an anchor-link sidebar and direct FAQ anchor links with `aria-current="true"` on active sections and open or deep-linked FAQ items.

- The active sidebar section is detected via `IntersectionObserver` (`src/hooks/useActiveSection.ts`).
  The observer uses a `-80px 0px -60% 0px` root margin so the active link updates slightly
  before the section reaches the top of the viewport, and a multi-threshold `[0, 0.25, 0.5, 0.75, 1]`
  so the most-visible section wins when multiple overlap.
- Each FAQ item features a direct anchor link (`<a href={`#${item.id}`}>`) and accordion control.
  When an FAQ is opened or deep-linked via URL hash, `aria-current="true"` is applied to its anchor link and accordion control.
- Only active/open nav and FAQ links carry `aria-current="true"`. The attribute is absent on all
  other links.
- Clicking an anchor calls `target.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
  Reduced-motion state is read from `useReducedMotion()` — when active, behavior switches to
  `"instant"`.
- The `<nav>` has `aria-label="Help topics"`. Links are real `<a href="#id">` elements —
  keyboard navigable via Tab, activatable via Enter/Space, and receive the global
  `:focus-visible` ring from `src/index.css`.

---

## 3. Component audit

The table below is updated on every accessibility-impacting PR. Status legend:
**OK** = audited and passing, **TODO** = known gap with target fix below.

| Component | Keyboard | ARIA | Contrast | Motion | Status |
| --- | --- | --- | --- | --- | --- |
| `WalletButton` | Tab/Enter/Esc; trigger has `aria-haspopup`/`aria-expanded` | `aria-label` on icon-only states | AA | n/a | OK |
| `WalletConnectionModal` | Focus trap + return; Escape closes | `role="dialog"`, `aria-modal`, `aria-labelledby` | AA | reduced-motion gated | OK |
| `ShortcutHelpOverlay` | Global `?` trigger outside text inputs; Escape closes; focus returns | `role="dialog"`, `aria-modal`, grouped shortcut lists | AA | reduced-motion gated | OK |
| `OnboardingFlow` | Arrow keys advance/back; Esc skips | Stepper labelled via `aria-label` | AA | `useReducedMotion()` | OK |
| `FormField` | Native input semantics | Auto `htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required` | AA | n/a | OK |
| `FormMessage` | n/a (text only) | `role="alert"` on error | AA | reduced-motion gated | OK |
| `AmountInput` | Native input + preset buttons; Tab in order | `aria-describedby` aggregates helper/constraint/status/error | AA | n/a | OK |
| `PendingButton` | Disabled during pending; Enter submits | `aria-busy="true"` while pending | AA | n/a | OK |
| `TransactionStatus` | n/a (auto-rendered at end of draw flow) | `role="status"` + `aria-live="polite"` so the result is announced when it replaces the loading spinner; status icon is `aria-hidden`; outcome heading + pattern fill provide dual-channel identification (WCAG 1.4.1) | AA | n/a | OK |
| `StatusBadge` | n/a (display) | `aria-label="Credit line status: …"` | AA | n/a | OK |
| `Skeleton` | n/a | n/a | n/a | reduced-motion gated | OK |
| `CopyToClipboard` | Real `<button>`; Enter copies | Specific `aria-label`; polite live region announces "Copied" | AA | n/a | OK |
| `AccessibleTooltip` | Trigger is keyboard-focusable | `role="tooltip"`, `aria-describedby` | AA | n/a | OK |
| `RouteAnnouncer` | n/a (route observer) | Updates `document.title`, meta description, and a polite live region | AA | n/a | OK |
| `NotificationBell` | Tab/Enter; counter is decorative | `aria-label="Notifications — N unread"` (custom `label` prop honored) | AA | n/a | OK |
| `NotificationCenter` | Focus trap inside the panel; mobile Expand/Collapse snap controls for keyboard users | `role="dialog"`, category filters use `role="tab"` + `aria-selected`; iOS safe-area insets on bottom sheet | AA | reduced-motion disables snap transitions | OK |
| `ToastContainer` | Tab/Esc to dismiss | `role="status"` / `role="alert"` per severity | AA | reduced-motion gated | OK |
| `BannerAlert` | Tab/Enter on action & dismiss | `role="alert"` for warning/error | AA | n/a | OK |
| `Dashboard` (risk gauge) | Tab/Enter/Space on SVG root and individual sector bands; keyboard fires `onSectorActivate` | Score and trend exposed via `<title>` + polite `sr-only` sibling; arc animates on value change with reduced-motion fallback; `ariaLabel` prop overrides the auto-generated description; SR-only risk-band table sibling with `aria-current` on the active band; `showSRTable` prop | AA | reduced-motion gated (CSS + JS `matchMedia`) | OK |
| `Dashboard` (colour-blind v7, #565) | Util-bar fill, summary-card stripe, per-line mini util-bar, notification severity, and risk-gauge tier glyph all carry non-colour modifiers (`util-fill--{level}`, `summary-card--*`, `notification-item--{info\|warning\|danger}`, `data-tier`); patterns defined in `src/styles/patterns.css`; high-contrast bumps opacities; forced-colours suppresses patterns | AA | reduced-motion gating inherited from existing transitions | OK |
| `RepaymentVisualizer` | n/a (display chart) | `role="img"` SVG with `aria-label` (overridable via `chartAriaLabel` prop); SR-only data table with `<caption>` auto-generated from term + total interest (overridable via `caption` prop); visible schedule table with expand/collapse | AA | n/a | OK |
| `Header` nav | Tab through links; Enter activates | `aria-current="page"` on active link | AA | n/a | OK |
| `RepayModal` | Focus trap (canonical `{ isActive }` form) + return focus to trigger | `role="dialog"`, `aria-modal`, `aria-labelledby` | AA | n/a | OK |
| `CreditLines` | Sortable header buttons keyboard reachable; selection checkboxes announce via `aria-label`; full-page compare Link has `aria-disabled` mirroring the `disabled` state of the inline trigger | Page root carries `data-reduced-motion={"true"\|"false"}` reflecting the union of OS preference and the `ReducedMotionContext` override; current count vs. selected count readable in DOM | AA | reduced-motion gated (CSS `@media (prefers-reduced-motion: reduce)` + `[data-motion="reduced"]` covering `.cl-card`, `.cl-empty`, `.cl-util-fill`, `.cl-filter-group select`, `.cl-sort-dir`, `.cl-primary-btn`, `.cl-action-btn`) | OK |
| `TransactionHistory` | Sortable headers via Enter/Space; search combobox fully keyboard navigable (ArrowDown/Up, Enter, Escape, Tab) | `aria-sort` reflects column state; search uses ARIA 1.2 combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`); result count in polite live region | AA | reduced-motion disables listbox animation | OK |
| `HelpCenter` | Tab/Enter on sidebar anchor links and FAQ anchor buttons; accordion buttons and transcript links keyboard reachable | Sidebar nav has `aria-label="Help topics"`; `aria-current="true"` on active section via IntersectionObserver and active/deep-linked FAQ anchors | AA | `useReducedMotion()` gates smooth scroll | OK |
| `SupportWidget` | Floating trigger, search field, FAQ toggles, and email handoff are keyboard reachable | `aria-expanded`, `aria-controls`, visible focus ring, non-modal `role="dialog"` shell | AA | n/a | OK |
| `LandingPage` | Tab through CTAs and FAQ accordion | Framer Motion guarded by `useReducedMotion` | AA | reduced-motion gated | OK |
| `ErrorBoundary` / `ErrorPage` | Tab through "Go back" and "Reload" | Semantic landmarks | AA | n/a | OK |
| `LoginPage` | Tab through all inputs, checkbox, links, submit; Shift+Tab reverses | Both fields use `<FormField>` — `aria-describedby` always present on password input (`password-help`; `password-help password-error` on error), `aria-required="true"`, `aria-invalid` toggled by error state | AA | n/a | OK |

### Known gaps and target fix dates

| ID | Component | Gap | Target |
| --- | --- | --- | --- |
| ~~A11Y-001~~ | ~~`OnboardingFlow`~~ | ~~Arrow-key step navigation not wired (today uses Next/Back buttons only)~~ | **Fixed** — arrow keys now advance/back and Escape skips; regression tests added |
| ~~A11Y-002~~ | ~~`RepayModal`~~ | ~~Focus-trap call site uses legacy boolean signature; needs migration to `useFocusTrap({ isActive })`~~ | **Fixed** — migrated to `{ isActive }` form; `triggerRef` wired; regression test added |
| A11Y-003 | `NotificationCenter` | Filter tabs use `aria-pressed` but should additionally expose `role="tab"` + `aria-selected` for AT consistency | next minor release |
| ~~A11Y-004~~ | ~~Tables~~ | ~~`aria-sort` is set but caption text describing the table is not yet announced~~ | **Closed** — `<caption>` added to TransactionHistory; `<section aria-label>` added to CreditLines; both update dynamically with filter state |
| ~~A11Y-005~~ | ~~`LoginPage`~~ | ~~Password `<input>` had no `aria-describedby` in the non-error state because `FormField` was rendered without `helpText`, violating WCAG 2.1 SC 1.3.1~~ | **Fixed** — added `helpText="Enter the password for your account"` to the password `FormField`; the input now always carries `aria-describedby="password-help"` (or `"password-help password-error"` when an error is active); 16-test suite added |

---

## 4. Touch targets

All interactive elements meet **44×44 CSS px**, derived from:

- WCAG 2.5.5 (AAA, 44×44 recommended)
- WCAG 2.5.8 (AA in 2.2, 24×24 minimum with spacing)
- Apple HIG 44 pt minimum
- Material Design 48 dp recommended

Use `min-width` / `min-height` (not fixed) so labels can grow with content. The canonical
pattern:

```css
.icon-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 0.625rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.compact-text-btn {
  min-height: 44px;
  padding: 0.625rem 0.5rem;
  display: inline-flex;
  align-items: center;
}
```

### Audited targets

| Component | Element | Before | After | Compliant |
| --- | --- | --- | --- | --- |
| `NotificationBell` | `.notif-bell` | ~30×30 | 44×44 | yes |
| `WalletConnectionModal` | `.close-btn` | 32×32 | 44×44 | yes |
| `NotificationCenter` | `.nc-icon-btn` | ~24×24 | 44×44 | yes |
| `NotificationCenter` | `.nc-close-btn` | ~24×24 | 44×44 | yes |
| `NotificationCenter` | `.nc-text-btn` | ~20 h | 44 h | yes |
| `NotificationCenter` | `.nc-filter-tab` | ~20 h | 44 h | yes |
| `NotificationCenter` | `.nc-item-action` | ~20 h | 44 h | yes |
| `BannerAlert` | `.banner-close` | ~20×20 | 44×44 | yes |
| `BannerAlert` | `.banner-action` | ~20 h | 44 h | yes |
| `ToastContainer` | `.toast-close` | ~20×20 | 44×44 | yes |
| `TransactionHistory` | `.export-btn` | ~32 h | 44 h | yes |
| `Dashboard` | `.wallet-address-chip` | ~32 h | 44 h | yes |
| `WalletButton` | `.connect-wallet-btn` | 44 h | 44 h | yes (already) |
| `WalletButton` | `.wallet-address-btn` | 44 h | 44 h | yes (already) |
| `WalletButton` | `.disconnect-btn` | 44 h | 44 h | yes (already) |

### Display-only exceptions

`network-badge`, `nc-badge`, `notif-bell-badge`, `status-badge`, `status-dot`, progress
bars and utilization bars are informational, not interactive, and are exempt from the
target rule.

---

## 5. Copy to clipboard contract

The shared `CopyToClipboard` component is the only sanctioned way to copy a wallet address
or transaction hash. Its contract:

- Renders a real `<button>` (never a `<div role="button">`).
- Pairs a visible `Copy` label with an icon; the icon is `aria-hidden`.
- Provides a specific `aria-label` like `Copy connected wallet address` or
  `Copy transaction hash for TX-001` when the value itself is not fully visible.
- On success, label flips to `Copied` for `COPY_FEEDBACK_DURATION_MS` (2000 ms) and a
  polite live region announces the change to screen readers.
- Keeps focus on the button so keyboard flow is unbroken.

---

## 6. Reduced motion

Every animation in the codebase is gated by
`@media (prefers-reduced-motion: reduce)` and the equivalent `[data-motion="reduced"]` attribute. 

For testing and verifying reduced-motion states without altering OS settings, use the **Reduced Motion Preview toggle** in the Settings page. This toggle sets `[data-motion="reduced"]` on the root `<html>` element, which disables animations globally across the app.

Inventory of CSS files with reduced motion overrides:
- `src/index.css` — two top-level reduced-motion blocks
- `src/components/Skeleton.css`
- `src/components/OnboardingFlow.css`
- `src/components/WalletConnectionModal.css`
- `src/components/FormField.css`
- `src/components/LandingPage.css`
- `src/pages/DrawCreditPage.css` — `.dc-page` scoped reset + static spinner fallback
- `src/pages/RepayPage.css` — `.repay-page` scoped reset

JS-driven animations (Framer Motion) call `useReducedMotion()` from the context and switch to instant
state changes. The landing hero in `src/components/LandingPage.tsx` and risk gauge in `src/components/RiskGauge.tsx` are canonical examples.

---

## 7. Testing tools

| Tool | Use |
| --- | --- |
| `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` | Component and integration tests — query by role, simulate real keyboard events |
| `vitest` | Test runner |
| `jsdom` | DOM environment for tests (configured in `vitest.config.ts`) |
| **axe-core / @axe-core/react** | Recommended addition for automated CI scanning |
| **Lighthouse** (browser DevTools or CI) | Per-route accessibility audit, drives the score reported in `PERFORMANCE.md` |
| Manual screen-reader checks | VoiceOver (macOS), NVDA (Windows), TalkBack (Android) before any release that ships overlay or form changes |

Manual checklist before merging accessibility-impacting work:

1. Disconnect the mouse; navigate the full flow with Tab/Shift+Tab/Enter/Space/Esc.
2. Toggle `prefers-reduced-motion` in OS settings; confirm no animation plays.
3. Toggle Forced Colors (Windows) or Increase Contrast (macOS); confirm nothing
   disappears.
4. Run a screen reader through the changed surface and confirm errors, statuses, and
   live-region updates are announced.

---

## 8. Component-author checklist

Use this when adding or changing a UI surface. PRs that touch UI without this checklist
are bounced.

- [ ] Native HTML element used wherever possible (`button`, `a`, `label`, `nav`,
      `header`, `main`, `dialog`).
- [ ] Every icon-only control has `aria-label`.
- [ ] Every form field uses `<FormField>` or replicates its label/help/error wiring.
- [ ] Color is never the sole signal — glyph, text, or icon backs it up.
- [ ] Touch targets ≥ 44×44 px.
- [ ] Focus is visible and logically ordered.
- [ ] Modals compose `useFocusTrap` + `useBodyScrollLock` + `useInertBackdrop`.
- [ ] All animation is gated by `prefers-reduced-motion`.
- [ ] Contrast meets AA against the surface it sits on (`COLOR.surface` for cards,
      `COLOR.bg` for the page).
- [ ] Screen-reader announcements are routed through a live region with the right
      politeness.
