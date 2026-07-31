# Accessible Toast Queue

**Campaign:** GrantFox FWC26  ·  **Issue:** #458 — "Add accessible toast queue with role=status"

A single, centralized toast queue for transient status messages. Mounted once in
`App.tsx` inside `NotificationProvider`, it renders every active toast in a
`role="status"` live region — WCAG 2.1 SC 4.1.3 (Status Messages).

---

## Overview

| Concern | Implementation |
|---|---|
| Centralized queue | One `<ToastContainer />` mounted in `src/App.tsx` renders all toasts from `NotificationContext` |
| Live-region semantics | Outer container: `role="status"` + `aria-live="polite"` + `aria-atomic="true"` + `aria-label="Notifications"` |
| Per-toast semantics | success/info/warning → `role="status"` + `aria-live="polite"`; error/danger → `role="alert"` + `aria-live="assertive"` |
| Auto-dismiss | 5 500 ms default (`duration` option), progress bar; `persistent: true` disables it |
| Stack cap | 5 toasts max (enforced in `NotificationContext`) |
| Safe areas | Mobile `--sat` / `--sar` / `--sal` offsets for notched devices |
| Reduced motion | `prefers-reduced-motion: reduce` disables enter/leave transitions |

---

## Component API

### `ToastContainer` (`src/components/ToastContainer.tsx`)

```tsx
import { ToastContainer } from './components/ToastContainer';

// Mount once inside <NotificationProvider>:
<NotificationProvider>
  <ToastContainer />
  <Routes>…</Routes>
</NotificationProvider>
```

No props. Reads `toasts` + `dismissToast` from `useNotifications()`.

### `useToast()` (`src/hooks/useToast.ts`)

Convenience wrapper around `addToast`/`dismissToast`:

```ts
const toast = useToast();

const id = toast.success('Repayment sent', 'Your payment is being processed.');
toast.error('Connection failed', 'Could not reach the Stellar network.', {
  persistent: true,
});
toast.info('New feature', 'Undo is now available.', {
  action: { label: 'Learn more', onClick: () => navigate('/help') },
});
toast.dismiss(id); // programmatic dismissal
```

`ToastOptions`:

| Option | Type | Default | Description |
|---|---|---|---|
| `category` | `NotificationCategory` | `'system'` | Governs per-category mute preferences |
| `duration` | `number` | `5500` | Auto-dismiss delay in ms |
| `persistent` | `boolean` | `false` | Keep until manually dismissed |
| `action` | `{ label, onClick }` | — | Optional inline CTA button |

### `addToast` (`src/context/NotificationContext.tsx`)

```ts
const { addToast } = useNotifications();
const id = addToast({
  type: 'success',
  title: 'Connected',
  message: 'Wallet connected successfully.',
  saveToHistory: false, // default: also saves to the notification inbox
});
```

Returns a stable id (empty string when the category is muted). Toasts are also
saved to the persisted inbox by default (`saveToHistory`).

---

## Visible behaviour

- Toasts appear **top-right**, stacking newest-first (capped at 5).
- Each toast: severity icon badge, title, message, optional action button, and a
  dismiss (×) button (44×44 px touch target, WCAG 2.5.5).
- A thin progress bar shows time remaining; it disappears for persistent toasts.
- Slide-in/fade enter animation and slide-out leave animation, disabled under
  `prefers-reduced-motion: reduce`.

---

## Accessibility (WCAG 2.1 AA)

| SC | Implementation |
|---|---|
| 4.1.3 Status Messages | `role="status"` container + per-item `role="status"` / `role="alert"` |
| 1.4.1 Use of Color | Severity conveyed by icon + text + left accent bar, not color alone |
| 1.4.3 Contrast | Title ≥ 4.5:1 on tinted surface; muted body ≥ 3:1 (see `ToastContainer.css` notes) |
| 2.1.1 Keyboard | All controls are real `<button>`s (dismiss, action) |
| 2.5.5 Target size | Dismiss + action buttons ≥ 44×44 px |
| 2.4.7 Focus visible | `:focus-visible` rings on dismiss/action buttons |
| Reduced motion | Transitions disabled under `prefers-reduced-motion: reduce` |
| Forced colors | Patterns/colors mapped to system tokens where applicable |

---

## Files

| File | Purpose |
|---|---|
| `src/components/ToastContainer.tsx` | Centralized queue component (mounted in `App.tsx`) |
| `src/components/notifications/ToastContainer.tsx` | `ToastItem` presentational component + inner queue |
| `src/components/notifications/ToastContainer.css` | Queue + item styles, safe-area & motion handling |
| `src/components/notifications/notificationIcons.tsx` | Severity icon + color maps |
| `src/context/NotificationContext.tsx` | `toasts` state, `addToast` / `dismissToast` dispatchers |
| `src/hooks/useToast.ts` | Typed convenience helpers |
| `src/types/notification.ts` | `Toast`, `NotificationType`, `NotificationCategory` types |

---

## Tests

```bash
npx vitest run src/components/ToastContainer.test.tsx
npx vitest run src/components/notifications/ToastContainer.test.tsx
npx vitest run src/components/notifications/UndoToast.test.tsx
```

Coverage: container ARIA attributes, per-severity roles, rendering all four
types, dismiss (×) removal, auto-dismiss after duration, persistent toasts,
stack cap (5), action buttons, empty queue, icon `aria-hidden`, severity theme
colors, safe-area CSS tokens (`--sat`/`--sar` in `safe-area.test.ts`).

---

## Notes

- The outer container intentionally does **not** set `aria-relevant="additions"`:
  each child `ToastItem` already carries its own live-region role, and restricting
  the parent causes inconsistent double-announcements across screen readers.
- `NotificationCenter` (mark-all-read / clear-all) emits undo toasts through this
  same queue — see `docs/NOTIFICATION_CENTER.md`.
