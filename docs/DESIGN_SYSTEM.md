# Design System

The Creditra design system is two files plus a Figma source-of-truth:

- `src/index.css` — runtime CSS custom properties consumed by every component
- `src/utils/tokens.ts` — TypeScript constants for components that style with inline
  `React.CSSProperties` (e.g. SVG fills on the risk gauge, badge palettes)
- [`Design System/`](../Design%20System/) — Figma-anchored reference for the canonical
  values

Any change that introduces a one-off color, spacing value, or radius is a review blocker.
Extend the token table instead.

---

## 1. Token catalogue

### Color

Semantic tokens (from `:root` in `src/index.css`):

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0d1117` | App background |
| `--surface` | `#161b22` | Cards, header, inputs |
| `--surface-raised` | `#1c2230` | Elevated surfaces over a card (additive) |
| `--surface-overlay` | `rgba(13,17,23,0.72)` | Modal backdrop |
| `--border` | `#30363d` | Card/input borders, dividers |
| `--text` | `#e6edf3` | Primary body text |
| `--muted` | `#8b949e` | Secondary text, placeholder |
| `--accent` | `#58a6ff` | Primary action, links, focus ring |
| `--success` | `#3fb950` | Positive status, repayments, low utilization |
| `--warning` | `#d29922` | Suspended status, medium utilization |
| `--error` | `#f85149` | Defaulted status, danger, high utilization |

Per-domain palettes (from `src/utils/tokens.ts`):

| Domain | Source | Mapping |
| --- | --- | --- |
| Credit-line status | `STATUS_COLOR` | `Active` → green; `Suspended` → amber; `Defaulted` → red; `Closed` → grey. Each entry is a `{bg, color, border}` triple tuned for AA contrast against `--surface`. |
| Utilization | `UTIL_COLOR` | `low` → success; `medium` → warning; `high` → danger. Threshold logic in `getUtilizationLevel(utilized, limit)`. |
| Risk score | `RISK_COLOR(score)` | `>= 700` → success; `>= 600` → warning; otherwise → danger. |
| Transaction type | `Dashboard.tsx:TX_COLOR` | `Draw` → danger; `Repay` → success; `Fee` → muted; `Interest` → warning. |

The Figma layer adds primitive scales (`rich-black/50…500`, `black/50…500`, `grey/50…500`,
`blue/50…500`, `green/50…500`) documented in
[`Design System/tokens.md`](../Design%20System/tokens.md). The runtime tokens above are the
semantic layer that resolves to these primitives.

### Spacing

Defined as CSS custom properties; every component reads them via `var(--space-*)`.

| Token | Value |
| --- | --- |
| `--space-xs` | `0.25rem` (4 px) |
| `--space-sm` | `0.5rem` (8 px) |
| `--space-md` | `0.75rem` (12 px) |
| `--space-lg` | `1rem` (16 px) |
| `--space-xl` | `1.5rem` (24 px) |
| `--space-2xl` | `2rem` (32 px) |

### Radii

| Token | Value | Used for |
| --- | --- | --- |
| `--radius-sm` | `4px` | Pills, chips, badges |
| `--radius-md` | `6px` | Buttons, inputs, cards |
| `--radius-lg` | `10px` | Modal containers, prominent surfaces |
| `--radius-pill` | `9999px` | Status dots, full-pill controls |

### Elevation

The system is intentionally flat. Elevation is communicated through *surface tone*, not
shadow:

| Token | Use |
| --- | --- |
| `--surface` | Default card / header |
| `--surface-raised` | Hover or selected state for cards |
| `--surface-overlay` | Modal backdrop (carries alpha so the page is dimmed but visible) |

The Figma layer defines `.shadow-sm`, `.shadow-md`, `.shadow-lg`, `.shadow-xl`,
`.shadow-none` for documents and marketing surfaces. The product UI does not use shadow.

### Typography

Line-height rhythm tokens drive vertical density:

| Token | Value | Applies to |
| --- | --- | --- |
| `--lh-display` | `1.2` | Display headings |
| `--lh-heading` | `1.3` | `h1`–`h6` |
| `--lh-body` | `1.6` | Body copy, `<p>` |
| `--lh-small` | `1.5` | Caption text |

Font stack: `system-ui, -apple-system, sans-serif` — declared on `body`. No web font is
loaded; this keeps CLS at zero and removes a third-party request.

#### Utility: tabular numerals

```css
.num-tabular,
.tabular-nums,
.amount,
[data-amount] {
  font-variant-numeric: tabular-nums;
}
```

Apply to any cell that displays money, percentages, or APR so digit widths are fixed and
columns stay visually stable as values change. Defined in `src/styles/typography.css` and
used on:

- `AmountInput` — draw field, available limit, validation metrics (`.tabular-nums.amount`)
- `TransactionHistory` — `tx-amount` / `th-stat-value` via `.num-tabular`
- `CreditLines` — Limit / Utilized / Available metric values plus utilization and APR/risk detail values via `.cl-amount`
- `ConfirmationStep`, `RepayModal`, `RepaySuccessShareCard` — amount summaries
- Dashboard summary cards via `.num-display` / `.num-tabular`

#### Utility: per-account color stripe

`src/utils/colorFromId.ts` maps a stable account id to a palette color via a djb2 hash.
Use `colorFromId(id)` for the hex token and `accountStripeStyle(id)` for a 3 px absolute
left-edge stripe. LinkedAccounts provider cards render the stripe + an inline swatch so
identity survives monochrome / forced-colors viewing (WCAG 1.4.1).

### Motion

Animations live in component CSS files; durations target 150–300 ms easing
`cubic-bezier(0.16, 1, 0.3, 1)`. Every animation is gated by
`@media (prefers-reduced-motion: reduce)`:

| File | What is gated |
| --- | --- |
| `src/index.css` | Two top-level reduced-motion blocks killing decorative animation |
| `src/components/Skeleton.css` | Shimmer animation paused |
| `src/components/OnboardingFlow.css` | Step transitions disabled |
| `src/components/WalletConnectionModal.css` | Sheet slide-in disabled |
| `src/components/FormField.css` | Inline error fade disabled |
| `src/components/LandingPage.css` | Hero animation disabled |

Framer Motion is used for the onboarding stepper and the landing hero; both call
`useReducedMotion()` so animation is conditionally suppressed at the JS level too
(see `LandingPage.tsx`).

---

## 2. Component library inventory

Every component below lives in `src/components/`.

### Inputs and form primitives

| Component | Purpose | A11y contract |
| --- | --- | --- |
| `FormField` | Labelled input/textarea/custom child with help and error slots | `htmlFor` linkage, `aria-describedby`, `aria-invalid`, `aria-required` set automatically; required indicator announced |
| `FormMessage` | Tone-coded helper/error text | `role="alert"` for `danger`; live region wrapping for transient feedback |
| `AmountInput` | Currency input with preset chips (25/50/75/100%) and per-severity feedback | `aria-describedby` aggregates helper + constraint + status + error IDs |
| `HealthFactorChart` | Per-credit-line health-factor trend (SVG + SR table) | `role="img"` + labelledby; band label pairs colour with text |
| `PendingButton` | Submit button with inline spinner | `aria-busy="true"` while loading; spinner `aria-hidden` so label-change communicates state |

### Status, feedback, success

| Component | Purpose | Notes |
| --- | --- | --- |
| `StatusBadge` | Pill for `CreditLineStatus` | Color + glyph cue (`A`, `!`, `X`, `C`) so meaning survives monochrome screenshots |
| `AgingTag` | Flag for delinquent lines | High-contrast danger style + Clock icon, text is self-labelling for screen readers |
| `Skeleton` | Shimmer placeholder | Animation respects `prefers-reduced-motion` |
| `SuccessState` | Post-action confirmation | `role="status" aria-live="polite"` |
| `TransactionStatus` | Pending / success / failure for draws and repays | Step indicator + retry CTA |
| `ErrorBoundary` | Class-component render guard | Renders `ErrorPage` with semantic landmarks |
| `TermsBanner` | Banner for terms updates + acceptance | Persistent banner for GrantFox FWC26 campaign with Review Modal and keyboard-trapped overlay |

### Overlay

| Component | Purpose | Composed hooks |
| --- | --- | --- |
| `WalletConnectionModal` | Pick wallet, see install state | `useFocusTrap` + `useBodyScrollLock` + `useInertBackdrop` |
| `RepayModal` | Repay flow with input + confirm + status | `useFocusTrap` |
| `OnboardingFlow` | 3-step intro for first-time wallet users | Framer Motion + `useReducedMotion` |

### Wallet

| Component | Purpose |
| --- | --- |
| `WalletButton` | Header CTA; switches between "Connect" and connected-chip; surfaces wallet dropdown |

### Credit-line UI

| Component | Purpose |
| --- | --- |
| `CreditLineSelector` | First step of the draw wizard |
| `CreditLineSummaryBlock` | Card summarising a single credit line |
| `CreditLineDetailDrawer` | Slide-out sheet summarizing credit line details, trend, and transactions |
| `PreviewSection` | Pre-confirmation preview of a draw |
| `ConfirmationStep` | Final confirm step with APR + total cost |

### A11y primitives

| Component | Purpose |
| --- | --- |
| `AccessibleTooltip` | Keyboard-focusable info trigger; `role="tooltip"` + `aria-describedby` |
| `CopyToClipboard` | Real `button` with `aria-label`, success affordance announced via polite live region (`Copy` → `Copied` for 2 s) |

### Notifications system (`src/components/notifications/`)

| Component | Purpose |
| --- | --- |
| `NotificationBell` | Header trigger with unread badge; 44×44 px target |
| `NotificationCenter` | Side panel (≥768px) or bottom sheet with 50%/90% snap points (&lt;768px); category filters, mark-read, clear-all |
| `ToastContainer` | Stack of transient toasts |
| `BannerAlert` | Page-level alert with action + dismiss |
| `notificationIcons.tsx` | Per-type icon set |

---

## 3. Theming

The app currently ships a single, opinionated **dark theme**. That is a product choice for
the initial release — finance UIs read better in low light during night-time market
activity, and our user research showed strong preference for a dark default.

Hooks are already in place for a light theme:

- **CSS custom properties** make the swap trivial — re-declaring the same `:root` keys
  inside `[data-theme="light"]` would flip the entire UI without component changes.
- **`prefers-color-scheme: dark`** is honoured in `WalletConnectionModal.css`, which is
  where the first hook for OS-driven theming was added.
- **Token-only inline styles** (`src/utils/tokens.ts`) need a second pass — they currently
  return hex literals tied to the dark palette. The fix is to read from
  `getComputedStyle(document.documentElement)` instead.

Planned rollout:

```mermaid
flowchart LR
    A["Single dark theme<br/>(today)"] --> B["Tokens swap on<br/>[data-theme=light]"]
    B --> C["Manual toggle in<br/>Settings page"]
    C --> D["Respect prefers-color-scheme<br/>by default"]
```

The toggle UX will be a tri-state radio — `System | Light | Dark` — persisted to
`localStorage` via the existing `src/utils/storage.ts` safe wrappers.

---

## 4. Density rules

Density is a function of *what a screen is for*, not a single user setting.

| Screen class | Vertical rhythm | Pattern |
| --- | --- | --- |
| Dashboard summary | Loose — `--space-xl` between cards, `--space-lg` inside | Reading-first, scannable, generous whitespace |
| Tables (Transactions, Credit Lines) | Tight — `--space-md` row padding, `--space-sm` between columns | Compare-first, density helps comparison |
| Forms (Draw wizard, Auth, Evaluation) | Medium — `--space-lg` between fields, `--space-md` inside fields | Read-and-act, one field of focus at a time |
| Modals | Medium — same as forms | Single task in a constrained surface |

Touch targets stay at 44×44 px regardless of density (see [`ACCESSIBILITY.md`](ACCESSIBILITY.md)).

---

## 5. Motion principles

1. **Motion communicates state change, never decoration.** A skeleton shimmer says "this
   is loading"; a success checkmark sweep says "this completed". Motion that does not
   answer "what changed?" is removed.
2. **150–300 ms.** Anything longer feels slow on a finance UI where users repeat actions.
3. **Easing carries direction.** Enter animations ease-out (decelerating arrival); exit
   animations ease-in (accelerating departure). The shared curve is
   `cubic-bezier(0.16, 1, 0.3, 1)`.
4. **`prefers-reduced-motion` collapses to instant.** No animation, no transition. Every
   stylesheet listed in section 1 enforces this.
5. **Framer Motion is OK for compound transitions** (e.g. step transitions in
   `OnboardingFlow`), CSS is preferred for everything else.

---

## 6. Visual examples

### Risk gauge (Dashboard)

Implemented inline in `src/pages/Dashboard.tsx` as an SVG semicircle. A 180° arc from
`(cx - r, cy)` to `(cx + r, cy)` is drawn twice — a muted background path and a coloured
score (`0–100`). The colour comes from `RISK_COLOR(score)` and the trend arrow is
`▲ | ▼ | ─` paired with `improving | declining | stable` text — never colour alone.

### Risk bands

`RiskBand` pairs a colored background with a secondary visual pattern to distinguish risk levels without relying solely on color (WCAG 1.4.1).
- **Excellent/Success**: Minimal dotted pattern (`radial-gradient`).
- **Good/Warning**: Diagonal stripes.
- **Caution & Recovery/Danger**: Crosshatch pattern.

### Status badge

`StatusBadge` pairs a tinted pill with a single-letter glyph (`A`, `!`, `X`, `C`). The
pill's `background`, `color`, and `borderColor` come from `STATUS_COLOR[status]`. Even in
greyscale, the glyph distinguishes Active from Suspended from Defaulted from Closed.

### Header active link

`.header-nav-link.active` adds three indicators on top of the accent colour: a 2 px bottom
border, a font-weight bump to 600, and an 8 %-opacity accent background. `aria-current="page"`
is set on the active link. This is the canonical demonstration of WCAG 1.4.1 (Use of
Color) plus 2.4.8 (Location) in the codebase.

### Skeleton shimmer

`components/Skeleton.css` defines the shimmer keyframes and the
`@media (prefers-reduced-motion: reduce)` block that disables them. The component is a
`<div>` with `width`/`height` passed through props so a loading state can match its target
layout exactly.

### Modal backdrop

The modal backdrop is `--surface-overlay` (a 72 %-alpha layer over `--bg`) so the page
behind remains legible but de-emphasised. Background content is also marked `inert` so
assistive tech skips it entirely.

---

## 8. Safe-area insets (iOS PWA)

When the app runs as a PWA (or in Safari with `viewport-fit=cover`), iOS exposes four
[CSS environment variables](https://developer.apple.com/documentation/safari-developer-tools/css-env-variables)
that describe how much of the display is hidden behind the notch, home indicator, and
rounded corners.

### Prerequisite

`index.html` must include `viewport-fit=cover` in the viewport meta tag:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Without this, `env(safe-area-inset-*)` always returns `0`.

### Tokens (`src/styles/safe-area.css`)

Four shorthand tokens are declared on `:root` and updated automatically:

| Token | Maps to | Typical device value |
| --- | --- | --- |
| `--sat` | `env(safe-area-inset-top, 0px)` | 47–59 px on Face ID iPhones |
| `--sar` | `env(safe-area-inset-right, 0px)` | 0 px portrait / ~44 px landscape |
| `--sab` | `env(safe-area-inset-bottom, 0px)` | 34 px (home-indicator models) |
| `--sal` | `env(safe-area-inset-left, 0px)` | 0 px portrait / ~44 px landscape |

Fallback is `0px` on browsers that do not support `env()` (desktop Chrome/Firefox, JSDOM).

### Utility classes

| Class | Effect |
| --- | --- |
| `.safe-top` | `padding-top: var(--sat)` |
| `.safe-bottom` | `padding-bottom: var(--sab)` |
| `.safe-left` | `padding-left: var(--sal)` |
| `.safe-right` | `padding-right: var(--sar)` |
| `.safe-x` | left + right |
| `.safe-y` | top + bottom |
| `.safe-all` | all four sides |
| `.fixed-safe-top` | `position:fixed; top:0; padding-top: var(--sat)` |
| `.fixed-safe-bottom` | `position:fixed; bottom:0; padding-bottom: var(--sab)` |
| `.mt-safe / .mr-safe / .mb-safe / .ml-safe` | margin variants |
| `.scroll-pb-safe` | `padding-bottom: calc(var(--sab) + var(--scroll-pb-extra))` |

### Bespoke usage (calc)

When you need to combine an existing base padding with the safe-area inset, use `calc()`:

```css
/* Good — preserves the 0.75rem base and adds the inset on top */
padding-top: calc(0.75rem + var(--sat, 0px));

/* Avoid — overwrites the base padding entirely */
padding-top: var(--sat);
```

### Components already using these tokens

| Component | Token | Why |
| --- | --- | --- |
| `.header` (`index.css`) | `--sat` | Clears status bar in standalone mode |
| `DrawSummaryBar` | `--sab` | Clears home indicator at bottom |
| `NotificationCenter` (mobile sheet) | `--sat`, `--sab` | Full-height bottom sheet |
| `ToastContainer` (mobile) | `--sat`, `--sar` | Top-right corner on notched devices |
| `KycDrawer` | `--sat`, `--sab` | Right-side drawer, full height |
| `OfflineBanner` | `--sab` | Fixed banner above home indicator |

### Testing

`src/styles/safe-area.test.ts` contains 38 unit tests.  Because JSDOM does not implement
`env()`, the tests verify:

1. The CSS source text contains the correct token declarations and utility rules.
2. CSS custom properties set via `el.style.setProperty()` are readable via
   `getComputedStyle(el).getPropertyValue('--sat')`.
3. `index.html` contains `viewport-fit=cover`.
4. `index.css` imports `safe-area.css`.
5. Every affected component CSS file references the relevant `--sat`/`--sar`/`--sab`/`--sal` token.

Live `env()` resolution on a physical iOS device is validated by the Playwright E2E suite.

---

## 8. Safe-area insets (iOS PWA)

When the app runs as a PWA (or in Safari with `viewport-fit=cover`), iOS exposes four
[CSS environment variables](https://developer.apple.com/documentation/safari-developer-tools/css-env-variables)
that describe how much of the display is hidden behind the notch, home indicator, and
rounded corners.

### Prerequisite

`index.html` must include `viewport-fit=cover` in the viewport meta tag:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Without this, `env(safe-area-inset-*)` always returns `0`.

### Tokens (`src/styles/safe-area.css`)

Four shorthand tokens are declared on `:root` and cascade to all components:

| Token | Maps to | Typical device value |
| --- | --- | --- |
| `--sat` | `env(safe-area-inset-top, 0px)` | 47–59 px on Face ID iPhones |
| `--sar` | `env(safe-area-inset-right, 0px)` | 0 px portrait / ~44 px landscape |
| `--sab` | `env(safe-area-inset-bottom, 0px)` | 34 px (home-indicator models) |
| `--sal` | `env(safe-area-inset-left, 0px)` | 0 px portrait / ~44 px landscape |

Fallback is `0px` on browsers that do not support `env()` (desktop Chrome/Firefox, JSDOM).

### Utility classes

| Class | Effect |
| --- | --- |
| `.safe-top` | `padding-top: var(--sat)` |
| `.safe-bottom` | `padding-bottom: var(--sab)` |
| `.safe-left` | `padding-left: var(--sal)` |
| `.safe-right` | `padding-right: var(--sar)` |
| `.safe-x` | left + right |
| `.safe-y` | top + bottom |
| `.safe-all` | all four sides |
| `.fixed-safe-top` | `position:fixed; top:0; padding-top: var(--sat)` |
| `.fixed-safe-bottom` | `position:fixed; bottom:0; padding-bottom: var(--sab)` |
| `.mt-safe / .mr-safe / .mb-safe / .ml-safe` | margin variants |
| `.scroll-pb-safe` | `padding-bottom: calc(var(--sab) + var(--scroll-pb-extra))` |

### Bespoke usage (calc)

When you need to combine an existing base padding with the safe-area inset, use `calc()`:

```css
/* Good — preserves the 0.75rem base and adds the inset on top */
padding-top: calc(0.75rem + var(--sat, 0px));

/* Avoid — overwrites base padding entirely */
padding-top: var(--sat);
```

### Components using these tokens

| Component | Token(s) | Reason |
| --- | --- | --- |
| `.header` (`index.css`) | `--sat` | Clears status bar / notch in standalone mode |
| `DrawSummaryBar` | `--sab` | Clears home indicator at bottom |
| `NotificationCenter` (mobile sheet) | `--sat`, `--sab` | Full-height bottom sheet |
| `ToastContainer` (mobile) | `--sat`, `--sar` | Top-right corner on notched devices |
| `KycDrawer` | `--sat`, `--sab` | Right-side drawer spans full height |
| `OfflineBanner` | `--sab` | Fixed banner above home indicator |

### Testing

`src/styles/safe-area.test.ts` — 38 unit tests. Because JSDOM does not implement
`env()`, the tests verify:

1. The CSS source text contains the correct token declarations and utility class rules.
2. Custom properties set via `el.style.setProperty()` are readable via `getPropertyValue()`.
3. `index.html` contains `viewport-fit=cover`.
4. `index.css` imports `safe-area.css`.
5. Every affected component CSS file references the relevant `--sa*` token.

Live `env()` resolution on a physical iOS device is validated by the Playwright E2E suite.
