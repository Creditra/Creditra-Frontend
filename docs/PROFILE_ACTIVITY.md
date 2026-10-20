# Profile Activity — Shortcut Hint Chip

**Campaign:** GrantFox FWC26 (Stellar Wave)  
**Issue:** b#050  
**Feature:** Display a subtle keyboard shortcut hint chip on `ProfileActivity` for the primary "Refresh" action.

---

## Summary

`ProfileActivity` is a page-level component that renders the user's activity timeline alongside a primary "Refresh" action. The refresh button carries a `KbdHint` chip showing the `R` keyboard shortcut, and a global `keydown` listener triggers the same refresh when `R` is pressed outside editable fields.

---

## Files changed / added

| File | Change |
|---|---|
| `src/pages/ProfileActivity.tsx` | **New** — page component with refresh button, KbdHint, and keyboard shortcut |
| `src/pages/ProfileActivity.css` | **New** — design-token compliant styles |
| `src/pages/ProfileActivity.test.tsx` | **New** — 15 focused tests |
| `src/components/ShortcutHelpOverlay.tsx` | Updated — added Profile Activity section with "R" shortcut |
| `docs/PROFILE_ACTIVITY.md` | **New** — this file |

---

## Component API

```tsx
import { ProfileActivity } from './pages/ProfileActivity';
```

No props. Drop it on any route.

### Internal behaviour

1. Renders `<ProfileActivity>` with an `<h1>` title and a "Refresh" `<button>`.
2. The button contains a `<KbdHint keys="R" description="Refresh activity feed" />` chip.
3. A `keydown` listener on `document` catches the `R` key (case-insensitive) when no modifier keys are held and the target is not an editable element.
4. On refresh, the `ActivityTimeline` component is re-mounted (via `key` prop change) so it fetches fresh data.
5. A polite `role="status"` live region announces "Activity feed refreshed" for 3 seconds.

---

## Accessibility (WCAG 2.1 AA)

| Concern | Implementation |
|---|---|
| Screen reader support | `KbdHint` renders `.sr-only` text; refresh button has `aria-label="Refresh activity feed"` |
| Keyboard shortcut | `R` key triggers refresh (guarded against editable targets and modifier keys) |
| Live region | `role="status"` with `aria-live="polite"` announces refresh completion |
| Focus visible | `:focus-visible` outline on the refresh button via `var(--color-primary)` |
| Touch target | Refresh button has padding meeting 44×44 px minimum (WCAG 2.5.5) |

---

## Responsive design

- **Desktop (≥ 640 px):** Header row with title left, refresh button right.
- **Mobile (< 640 px):** Header stacks vertically; button spans full width below title.
- Uses CSS custom properties for dark mode and high contrast mode consistency.

---

## Testing

```bash
npx vitest run src/pages/ProfileActivity.test.tsx
```

**15 tests, 0 failures.**

### Coverage map

| Suite | Tests |
|---|---|
| Core rendering | title, button, ActivityTimeline |
| KbdHint | chip renders, aria-label |
| Keyboard shortcut | R key, r key, editable guard, Ctrl guard, Meta guard, Alt guard |
| Button click | click triggers refresh |
| sr-only | announcement content, role/aria-live/aria-atomic, auto-clear after 3 s |
| Responsive | narrow viewport renders without error |

---

## Design token consistency

All styling references CSS custom properties from `src/index.css`:
- `--text`, `--surface-raised`, `--border`, `--surface-hover`, `--border-hover`
- `--color-primary` for focus rings
- `--radius-md` for border radius
- Dark mode and high contrast mode supported via existing token system

No one-off hex values or hardcoded colours.
