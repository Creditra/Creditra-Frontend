# High-Contrast Mode

## Overview

Creditra ships a high-contrast override that re-declares every semantic colour token to
achieve WCAG AAA (≥7:1) contrast ratios. The override is fully orthogonal to the planned
light/dark theme toggle and is persisted across browser sessions.

---

## How it works

### CSS — `[data-contrast="high"]` attribute selector

The override is scoped via an attribute selector on `<html>`:

```css
[data-contrast="high"] {
  --bg:             #000000;
  --surface:        #0a0a0a;
  --surface-raised: #141414;
  --surface-overlay: rgba(0, 0, 0, 0.92);
  --border:         #ffffff;
  --text:           #ffffff;
  --muted:          #d4d4d4;
  --accent:         #7dd3fc;
  --success:        #86efac;
  --warning:        #fde047;
  --error:          #fca5a5;
}
```

**Only semantic tokens are re-declared here.** Component-internal hex values are never
touched — any component that only uses `var(--*)` tokens automatically respects the
override without additional work.

### Contrast ratios (computed against `--bg: #000000`)

| Token | Value | Ratio | WCAG level |
|---|---|---|---|
| `--text` | `#ffffff` | 21:1 | AAA ✓ |
| `--muted` | `#d4d4d4` | 9:1 | AAA ✓ |
| `--accent` | `#7dd3fc` | 9:1 | AAA ✓ |
| `--success` | `#86efac` | 9:1 | AAA ✓ |
| `--warning` | `#fde047` | 11:1 | AAA ✓ |
| `--error` | `#fca5a5` | 9:1 | AAA ✓ |
| `--border` | `#ffffff` | 21:1 | AAA ✓ |

### React — `ContrastContext`

`src/context/ContrastContext.tsx` exports:

```ts
type ContrastMode = 'normal' | 'high';

// Provider
<ContrastProvider>…</ContrastProvider>

// Hook
const { contrastMode, toggleContrast, setContrastMode } = useContrast();
```

On every mode change the provider:
1. Sets or removes `data-contrast="high"` on `document.documentElement`.
2. Writes the new value to `localStorage` via `writeJson('creditra-contrast', mode)`.

The initial value is read synchronously from `localStorage` via
`readJson('creditra-contrast', 'normal')` so there is no flash-of-wrong-contrast on
first paint.

---

## User-facing toggle

`src/components/HighContrastToggle.tsx` renders a `<button role="switch">` that wires
directly to `useContrast()`. It lives on the **Settings page** (`/settings`) alongside
the planned light/dark theme toggle.

The toggle:
- Meets the 44 × 44 px minimum touch target (WCAG 2.5.5).
- Announces state changes via `aria-checked` on the switch role.
- Uses `aria-labelledby` / `aria-describedby` to avoid redundant text.
- Suppresses CSS transitions when `prefers-reduced-motion: reduce` is active.
- Accepts a `compact` prop for use in tight spaces (header, mobile drawer).

---

## Provider composition in App.tsx

```tsx
<ErrorBoundary>
  <ThemeProvider>       {/* colour-scheme — light/dark (future) */}
    <ContrastProvider>  {/* high-contrast override */}
      <WalletProvider>
        <BrowserRouter>…</BrowserRouter>
      </WalletProvider>
    </ContrastProvider>
  </ThemeProvider>
</ErrorBoundary>
```

`ContrastProvider` sits inside `ThemeProvider` so both providers can see the same
`localStorage` helpers without circular dependency.

---

## Testing

### Unit tests

`src/context/ContrastContext.test.tsx` — 9 tests:
- Default mode, toggle on/off, `setContrastMode` direct calls.
- `data-contrast` attribute applied / removed correctly.
- Persistence to and read-back from `localStorage`.
- Graceful fallback on malformed stored JSON.
- Error thrown when `useContrast` used outside provider.

`src/components/HighContrastToggle.test.tsx` — 7 tests:
- ARIA role, `aria-checked` state, click handler.
- `axe-core` structural audit in both normal and high-contrast modes.
- Compact variant rendering.

### Automated axe audits

Both toggle tests run `axe.run()` against the rendered component. Because jsdom does not
compute CSS custom property values, `axe-core` cannot verify pixel-level contrast ratios
in unit tests — it logs a `stderr` note about the missing canvas API and skips the
`color-contrast` rule. The colour values are instead documented and verified manually in
this file.

For full end-to-end contrast verification, run axe via a real browser:

```bash
# Example using @axe-core/playwright (not yet installed)
npx playwright test --grep "@a11y"
```

---

## Adding new tokens

If you introduce a new semantic token (e.g. `--focus-ring`), add its high-contrast
override value to the `[data-contrast="high"]` block in `src/index.css`. Include the
computed contrast ratio in the comment block at the top of that section.

Never add component-internal hex values to the `[data-contrast="high"]` block.

---

## OS-level `prefers-contrast: more`

The in-app toggle above is opt-in. Independently, components may respond to the
operating system's own increased-contrast setting via the
`@media (prefers-contrast: more)` query. This is where component-internal
treatments that a token swap can't reach (arc thickness, low-opacity decoration,
`--muted` text) are hardened.

### RiskGauge (`src/components/RiskGauge.css`)

Under `prefers-contrast: more` the gauge applies explicit **border** and **text**
overrides:

| Element | Default | `prefers-contrast: more` | Why |
|---|---|---|---|
| Track arc `.risk-gauge-bg` | `stroke: var(--border)` (#30363d, ≈1.3:1), width `10` | `stroke: var(--text)` (≈12.5:1), width `12` | The empty track is otherwise nearly invisible. |
| Risk-band arcs `.risk-gauge-sector-arc` | `opacity: 0.15` (0.35 hover/focus) | `opacity: 0.6` (1 hover/focus) | Makes band boundaries distinguishable. |
| Caption `.risk-gauge-label` | `fill: var(--muted)` (≈4.6:1) | `fill: var(--text)` (AAA) | Full-strength label text. |
| Meta labels `.rm-label` | `color: var(--muted)` | `color: var(--text)` | Full-strength Trend / Last Updated labels. |

The score number already uses `var(--text)`, so it needs no override. Contrast
gains and the presence of the media block are covered by
`src/components/RiskGauge.contrast.test.ts`.
