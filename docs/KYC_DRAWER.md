# KYC Progress Drawer

**Campaign:** GrantFox  
**Feature:** A right-side drawer (mobile: bottom sheet) reachable from the header that surfaces KYC step progress and lets the user resume from where they left off.

---

## Overview

The KYC drawer lives permanently in the header as a small shield-icon button labeled **KYC**. Clicking it opens a panel showing:

- An ordered list of all 5 verification steps with their current status (not started / in progress / completed / failed / pending review)
- An overall status badge and `n / 5 steps` progress fraction
- A linear progress bar
- A **Resume** (or **Start**) CTA that navigates directly to the first incomplete step
- A sticky bottom action bar that fades in after the drawer body is scrolled, keeping the primary verification CTA visible while reviewing later steps

Progress is persisted to `localStorage` so the user picks up exactly where they left off across page refreshes and navigation.

---

## Files

| File | Purpose |
|---|---|
| `src/types/kyc.ts` | Domain types: `KycStepId`, `KycStepStatus`, `KycOverallStatus`, `KycStep`, `KycPersistedState` |
| `src/context/KycContext.tsx` | App-wide state provider; persistence, derived status, `setStepStatus`, `resetAll` |
| `src/components/KycDrawer.tsx` | `KycDrawer` panel + `KycTriggerButton` header button |
| `src/components/KycDrawer.css` | Component-scoped styles: slide-in desktop, bottom-sheet mobile, reduced-motion |
| `src/components/__tests__/KycDrawer.test.tsx` | Focused unit/integration coverage for drawer rendering, CTA behavior, and sticky action bar reveal-on-scroll |

---

## KYC Step Flow

```
identity → address → documents → selfie → review
```

Each step moves through this lifecycle:

```
not_started → in_progress → completed
                           ↘ failed  (re-submit required)
                           ↘ pending (awaiting backend review)
```

---

## Component API

### `KycDrawer`

```tsx
<KycDrawer
  isOpen={boolean}
  onClose={() => void}
  onResume={(stepId: string) => void}  // navigate to this step
  triggerRef={React.RefObject<HTMLElement>}
/>
```

`onResume` receives the `KycStepId` of the first `in_progress` step (or the first `not_started` step if none are in progress). Connect it to your router:

```tsx
onResume={(stepId) => navigate(`/kyc?step=${stepId}`)}
```

### `KycTriggerButton`

```tsx
<KycTriggerButton
  onClick={() => void}
  triggerRef={React.RefObject<HTMLButtonElement>}
/>
```

Reads `overallStatus` from `KycContext` and renders a coloured dot indicator when action is required (`in_progress`, `under_review`, `rejected`). No dot for `not_started` or `approved`.

---

## KycContext API

```ts
const {
  steps,           // KycStep[] — ordered step list
  overallStatus,   // KycOverallStatus — derived from step statuses
  resumeStepId,    // KycStepId | null — first in_progress or not_started step
  completedCount,  // number — completed steps (drives progress bar)
  setStepStatus,   // (stepId, status) => void
  resetAll,        // () => void — resets all to not_started (dev/testing)
} = useKyc();
```

Wrap your app tree in `<KycProvider>` (already done in `App.tsx`).

### Updating step status from a KYC page

```tsx
import { useKyc } from '../context/KycContext';

function IdentityStep() {
  const { setStepStatus } = useKyc();

  const handleStepStart = () => setStepStatus('identity', 'in_progress');
  const handleStepDone  = () => setStepStatus('identity', 'completed');
  // ...
}
```

---

## Resume logic

`resumeStepId` is derived in this priority order:

1. First step with status `in_progress` (user was midway through)
2. First step with status `not_started` (user hasn't started it yet)
3. `null` — all steps are either `completed`, `pending`, or `failed`

The CTA label changes accordingly:

| `overallStatus` | Button label |
|---|---|
| `not_started` | Start verification |
| `in_progress` | Resume verification |
| `under_review` | All steps submitted *(disabled)* |
| `approved` | All steps submitted *(disabled)* |
| `rejected` | Resume verification *(re-start failed step)* |

---

## Persistence

State is written to `localStorage` under the key `creditra_kyc` on every `setStepStatus` call. Schema:

```json
{
  "version": 1,
  "steps": [
    { "id": "identity", "label": "...", "description": "...", "status": "completed", "updatedAt": "2026-06-27T10:00:00Z" }
  ],
  "lastUpdated": "2026-06-27T10:05:00Z"
}
```

**Security note:** `localStorage` is unverified client-side data. Never use `overallStatus` to gate security decisions — always verify KYC status server-side.

---

## Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="kyc-drawer-title"`, `aria-describedby="kyc-drawer-desc"`
- Three hooks: `useFocusTrap` + `useBodyScrollLock` + `useInertBackdrop` (same pattern as `WalletConnectionModal`, `ShortcutHelpOverlay`)
- Escape key closes via both `useFocusTrap` and a direct `onKeyDown` on the panel element
- Step icons are `aria-hidden`; status communicated via `.sr-only` text on every step label (e.g. " — Completed")
- `aria-current="step"` on the current/resume step
- Progress bar: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Overall status `<span role="status">` in a polite live region
- `KycTriggerButton` has `aria-haspopup="dialog"` and a descriptive `aria-label` that includes current status when action is needed
- All interactive elements ≥ 44×44 px — WCAG 2.5.5
- Status communicated via colour + text label + shape (icon) — WCAG 1.4.1
- Mobile bottom sheet: drag-handle hint, full-width, rounded top corners
- Sticky action bar remains keyboard reachable and uses safe-area bottom padding so the CTA clears mobile gesture/home-indicator areas

---

## Tests

```bash
npx vitest run src/components/__tests__/KycDrawer.test.tsx
```

Includes focused coverage for the sticky action bar reveal-on-scroll behavior.

### What's tested

- Renders `null` when `isOpen=false`
- Dialog ARIA attributes (`role`, `aria-modal`, `aria-labelledby`, `aria-describedby`)
- Step list: 5 items, step numbers for not-started, `aria-current="step"` on resume step, sr-only status text
- Progress bar `valuenow` at 0% and 40% (2 completed)
- Status badge labels for all 5 `overallStatus` values
- CTA labels: "Start", "Resume", "All steps submitted"
- Sticky footer becomes visible after the drawer step list is scrolled
- CTA disabled state (approved / under_review)
- `onResume` called with correct `stepId` for not_started and in_progress cases
- `onClose` called after resume, via ×, backdrop click, and Escape
- `KycTriggerButton`: dot shown/hidden, dot colour class, `aria-haspopup`, `aria-label` with status, click handler

---

## Wiring KYC navigation

When a `/kyc` page exists, replace the `console.info` stub in `App.tsx` with real navigation:

```tsx
// App.tsx
<KycDrawer
  isOpen={isKycDrawerOpen}
  onClose={() => setIsKycDrawerOpen(false)}
  onResume={(stepId) => {
    navigate(`/kyc?step=${stepId}`);   // react-router v6
  }}
  triggerRef={kycTriggerRef}
/>
```
