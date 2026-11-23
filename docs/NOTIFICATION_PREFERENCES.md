# Per-User Notification Preferences

**Campaign:** GrantFox FWC26  
**Feature:** Per-user notification category toggles and channel delivery preferences for Creditra.

---

## Overview

The notification preference system enables users to granularly control which types of in-app notifications they receive across five functional categories, as well as configure delivery channels (Email, SMS, Push).

### Categories

| Category | Key | Description |
|---|---|---|
| **Transactions** | `transaction` | Payment confirmations, transfers, and real-time transaction activity |
| **Credit Lines** | `credit_line` | Limit adjustments, drawdown confirmations, repayment deadlines, and status updates |
| **Risk Score** | `risk_score` | Health factor updates, risk level shifts, watchlist additions, and collateral alerts |
| **Rate Changes** | `rate_change` | Interest rate movements, yield shifts, and market index recalculations |
| **System Notifications** | `system` | Platform announcements, scheduled maintenance windows, and security notices |

---

## Route & Navigation

- **URL:** `/settings/notifications`
- **Navigation:** Accessible via **Settings** (`/settings`) › **Category Preferences** or directly via `/settings/notifications`.
- **Cross-Link:** Links to `/notification-preferences` for delivery channel (Email/SMS/Push) settings.

---

## Component Topology & Architecture

```
App.tsx
 └── NotificationProvider (owns `preferences` and `updatePreferences`)
      └── BrowserRouter
           └── Routes
                └── /settings/notifications → NotificationSettings (src/pages/settings/Notifications.tsx)
```

### Persistence

- **Storage Key:** `creditra_notification_prefs` in `localStorage`.
- **Default State:** All categories default to `true` (enabled).
- **Context Integration:** `NotificationContext` reads and writes `creditra_notification_prefs` and suppresses toasts / inbox storage for muted categories.

---

## Features & Controls

1. **Master Toggle ("Enable All Notification Categories"):**
   - Quick one-click toggle to enable or disable all five category switches simultaneously.
2. **Per-Category Switch Toggles:**
   - Independent `<button role="switch" aria-checked>` toggles for each category with Lucide icons (`Receipt`, `CreditCard`, `AlertTriangle`, `TrendingUp`, `Bell`).
3. **Pending Button & In-Flight Feedback:**
   - `PendingButton` provides visual spinner and `aria-busy` feedback during save operations.
4. **Status & Warning Banners:**
   - Success banner (`role="status" aria-live="polite"`) when preferences are saved.
   - Warning banner (`role="alert"`) displayed when all notification categories are turned off.
5. **Reset to Defaults:**
   - One-click reset restoring all category switches to `true`.

---

## Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|---|---|
| Landmark structure | `<main aria-labelledby="notifications-page-title">` |
| Group semantics | `<fieldset>` containers with `<legend>` labels for each category |
| Switch toggles | `<button role="switch" aria-checked="..." aria-label="...">` |
| Live announcements | Success / error banners use `role="status"` / `role="alert"` with `aria-live="polite"` |
| Touch targets | Minimum 44 × 44 px target area (`.notif-toggle`, `.notifications-banner__dismiss`) |
| Focus rings | Custom `:focus-visible` outline rings with 2 px offset |
| Reduced motion | `prefers-reduced-motion: reduce` disables CSS transitions and animations |
| High contrast | `forced-colors: active` styles for Windows High Contrast Mode |

---

## Verification & Test Coverage

Run the unit and integration test suite:

```bash
cmd.exe /c npx vitest run src/pages/settings/__tests__/Notifications.test.tsx
```

### Tested Scenarios

- Page heading, subtitle, section titles, and info note rendering.
- All 5 category toggles + 1 master toggle rendered with correct initial states (`aria-checked="true"`).
- Master toggle enabling / disabling all switches.
- Individual category switch toggles updating local & context state.
- Save button enabling when dirty, pending state (`aria-busy`), success banner display, and `localStorage` persistence.
- Reset button restoring defaults.
- Warning banner rendering when all categories are disabled.
- Accessibility semantics (`role="switch"`, `aria-checked`, `fieldset`/`legend`, `role="status"`, `role="alert"`).
