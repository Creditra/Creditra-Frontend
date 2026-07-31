# Notification Center — Bottom Sheet on Mobile

**Campaign:** GrantFox  
**Feature:** On narrow viewports (≤ 640 px) the notification panel replaces the right-side popover with a full-height bottom sheet that slides up from the bottom edge, complete with a drag handle for touch dismiss.

---

## Overview

The notification system is now wired into the app through a single drop-in component — `NotificationWidget` — which co-locates the bell trigger and the panel, and passes a shared `triggerRef` between them so focus returns correctly to the bell on close.

### Desktop (> 640 px)
Slides in from the **right edge** at 380 px wide — same behaviour as before.

### Mobile (≤ 640 px)
Slides **up from the bottom** as a full-viewport bottom sheet with:
- Rounded top corners (`border-radius: 16px 16px 0 0`)
- A drag-handle pill at the top
- Pointer-based drag-to-dismiss (drag > 80 px down closes the panel)
- `padding-bottom: env(safe-area-inset-bottom)` for devices with home indicators
- `height: 100dvh` — uses the dynamic viewport height so the sheet is never clipped by the mobile browser toolbar

---

## Files changed / added

| File | Change |
|---|---|
| `src/components/notifications/NotificationCenter.tsx` | Rewrote: added drag handle markup, replaced manual scroll-lock + Escape effects with `useBodyScrollLock` + `useInertBackdrop` + `useFocusTrap`, added `triggerRef` prop, improved ARIA (`role="feed"`, `<article>`, `<time>`, action aria-label) |
| `src/components/notifications/NotificationCenter.css` | Rewrote: added `.nc-drag-handle-area` / `.nc-drag-handle`, `backdrop-filter` blur on backdrop, full mobile bottom-sheet block with safe-area insets, `visibility` transition to prevent invisible-but-interactive state, CSS custom properties throughout |
| `src/components/notifications/NotificationBell.tsx` | Converted to `React.forwardRef` so the parent can pass `triggerRef` to `NotificationCenter` |
| `src/components/notifications/NotificationWidget.tsx` | **New** — thin wrapper that owns `bellRef` and passes it to both siblings |
| `src/App.tsx` | Added `NotificationProvider` wrapper and `<NotificationWidget />` in the header |
| `src/components/__tests__/NotificationCenter.test.tsx` | **New** — 37 tests |
| `docs/NOTIFICATION_CENTER.md` | **New** — this file |

---

## Component API

### `NotificationWidget` _(recommended entry point)_

No props. Drop it wherever the bell should appear inside a `NotificationProvider`.

```tsx
import { NotificationWidget } from './components/notifications/NotificationWidget';

// In App.tsx header:
<NotificationWidget />
```

### `NotificationBell`

`React.forwardRef<HTMLButtonElement, { label?: string }>` — forwards its ref to the parent for the `triggerRef` handshake. Optional `label` prop overrides the accessible name (default `"Notifications"`); when unread it becomes `"{label} — N unread"`. Plays a one-shot `.bell-pulse` ring when a new danger/error notification arrives (disabled under `prefers-reduced-motion: reduce`).

### `NotificationCenter`

```tsx
interface NotificationCenterProps {
  /**
   * Ref to the bell button that opened the panel.
   * Passed to useFocusTrap so focus returns to the bell on close.
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
}
```

---

## Drag-to-dismiss

The drag handle area (`div.nc-drag-handle-area`) uses pointer events:

```
pointerdown  — record start Y, capture pointer
pointermove  — translate the panel downward (visual feedback, no upward movement)
pointerup    — if delta > 80 px → closePanel(); else snap back
pointercancel — snap back (e.g. browser gesture intercepted)
```

`touch-action: none` on the handle area prevents the browser's scroll gesture from fighting the drag. The visual translate is applied as an inline style so it overrides the CSS transition during the drag; the transition is restored on pointer release by clearing the style.

---

## Accessibility

| Concern | Implementation |
|---|---|
| Dialog semantics | `role="dialog"`, `aria-modal`, `aria-label="Notification center"` |
| Focus trap | `useFocusTrap` — Tab/Shift+Tab cycle, Escape to close, return focus to bell |
| Background content | `useInertBackdrop` — siblings marked `inert` / `aria-hidden` while open |
| Body scroll | `useBodyScrollLock` — prevents background scroll on both desktop and mobile |
| Escape redundancy | `onKeyDown` on the panel element as a defence-in-depth fallback |
| Return focus | `NotificationBell` forwards its ref → `NotificationCenter` triggerRef → `useFocusTrap` returns focus on close |
| Notification items | `<article>` elements with `aria-label="{title}[, unread]"` |
| Timestamps | `<time dateTime={iso}>` — machine-readable ISO timestamp |
| Action buttons | `aria-label="{label} for notification: {title}"` |
| Feed semantics | `role="feed"` on the list container; `aria-label` includes count |
| Status badge | `role="status"` on overall badge; `aria-live="polite" aria-atomic` on the status row |
| Empty state | `role="status"` on empty container |
| Preferences toggle | `aria-expanded` + `aria-controls="nc-prefs-panel"` |
| Filter tabs | `role="tablist"` + `role="tab"` + `aria-selected` |
| Unread dots | `aria-hidden="true"` — communicated via article `aria-label` suffix `, unread` |
| Bell button | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls="notification-center"` |
| Badge | `aria-hidden="true"` — count in bell `aria-label` |
| WCAG 2.5.5 | All interactive elements ≥ 44 × 44 px |
| WCAG 1.4.1 | Unread state communicated by dot + label text, not colour alone |
| `prefers-reduced-motion` | All transitions/animations disabled |

---

## Replacing the manual scroll-lock pattern

The old implementation had a local `useEffect` that called `document.body.style.overflow = 'hidden'` only when `window.matchMedia('(max-width: 640px)')` matched. This was replaced with `useBodyScrollLock({ isLocked: isPanelOpen })` which:

- Locks on **both** desktop and mobile (prevents background scroll on all viewports)
- Preserves and restores `scrollY` position on unlock
- Is the same hook used by every other modal/overlay in the project

The old duplicate Escape listener (`document.addEventListener('keydown', ...)`) was removed — `useFocusTrap` already handles Escape via its own `document` listener, and there is an `onKeyDown` on the panel element as a fallback for test environments where the hook's listener may not fire.

---

## Tests

```bash
npx vitest run src/components/__tests__/NotificationCenter.test.tsx
```

**37 tests, 0 failures.**

### Coverage map

| Suite | Tests |
|---|---|
| NotificationCenter | 27 |
| NotificationBell | 9 |
| NotificationWidget | 3 |

**NotificationCenter** — panel visibility (open/closed aria-hidden), ARIA attrs, dismiss via ×/backdrop/Escape, "Mark all read" enabled/disabled state, "Clear all" presence, mark-all-read mutation, clear-all mutation, prefs panel show/hide, prefs aria-expanded, 6 filter tabs, default tab selection, tab click selection, empty state, article rendering, aria-label, unread dot, click-to-mark-read, action button callback, drag handle DOM presence.

**NotificationBell** — aria-haspopup, aria-expanded, badge absent/present, 99+ cap, bell click opens panel, aria-controls.

**NotificationWidget** — bell + dialog both rendered, bell opens panel, × closes panel.

### Test strategy notes

- Accessibility hooks (`useFocusTrap`, `useBodyScrollLock`, `useInertBackdrop`) are mocked — identical pattern to `CollateralSubstitutionModal` and `KycDrawer` tests.
- Notifications are seeded via a `<Seeder>` component that calls `addToast` in `useEffect` inside the `NotificationProvider` tree — avoids the render-phase state-update trap.
- Dismiss assertions check `aria-hidden` attribute rather than `queryByRole` absence, because the panel stays in the DOM (CSS-driven visibility) and is only removed from the accessibility tree via `aria-hidden`.

---

## Mobile CSS quick reference

```css
@media (max-width: 640px) {
  .nc-panel {
    inset: auto 0 0 0;          /* pin to bottom edge */
    width: 100%;
    height: 100dvh;             /* dynamic viewport height */
    border-radius: 16px 16px 0 0;
    transform: translateY(100%); /* start off-screen below */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .nc-panel-open {
    transform: translateY(0);
  }

  .nc-drag-handle-area {
    display: flex;   /* hidden on desktop via display:none */
  }
}
```
