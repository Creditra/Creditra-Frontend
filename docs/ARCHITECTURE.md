# Architecture

This document is the frontend's system-design reference. It is grounded in the actual
files under `src/` — every component, hook, and provider named below is a real export.

The intent: a reviewer should be able to read this in five minutes and understand how a
user click becomes a network request, how a wallet signature flows back into the UI, and
where the boundaries of responsibility sit.

---

## 1. Component topology

```mermaid
flowchart TB
    Boot["main.tsx<br/>(StrictMode + ReactDOM root)"] --> App["App.tsx"]
    App --> EB["ErrorBoundary<br/>(class component, catches render errors)"]
    EB --> WP["WalletProvider<br/>(connection lifecycle)"]
    WP --> Router["BrowserRouter"]

    Router --> Header["Header<br/>(NavLink + WalletButton)"]
    Router --> Main["main element"]

    Main --> R1["/&nbsp;Dashboard<br/>pages/Dashboard.tsx"]
    Main --> R2["/transactions<br/>pages/TransactionHistory.tsx"]
    Main --> R3["/draw-credit<br/>pages/DrawCreditPage.tsx"]
    Main --> R4["/open-credit<br/>pages/RequestEvaluation.tsx"]
    Main --> R5["* NotFound<br/>pages/NotFound.tsx"]

    R1 --> C1["StatusBadge<br/>Skeleton<br/>CopyToClipboard<br/>RiskGauge<br/>(src/components/RiskGauge.tsx)"]
    R3 --> C2["CreditLineSelector ▸<br/>AmountInput ▸<br/>PreviewSection ▸<br/>ConfirmationStep ▸<br/>TransactionStatus"]
    Header --> C3["WalletButton ▸<br/>WalletConnectionModal ▸<br/>OnboardingFlow"]

    C3 -.->|composes| H1["useFocusTrap"]
    C3 -.->|composes| H2["useBodyScrollLock"]
    C3 -.->|composes| H3["useInertBackdrop"]

    classDef route fill:#1c2230,stroke:#58a6ff,color:#e6edf3;
    class R1,R2,R3,R4,R5 route;
```

The header is rendered outside `<Routes>` so it persists across navigation. The
`ErrorBoundary` is wrapped *outside* `WalletProvider` so that even a failure inside the
wallet reducer renders the error page instead of a blank screen.

---

## 2. Data flow

The app is a client-rendered SPA. There is no SSR. Soroban contract calls are signed
client-side by the connected wallet extension; the backend exposes read-only views over
the indexer.

```mermaid
sequenceDiagram
    actor User
    participant UI as Page / Component
    participant Ctx as WalletContext
    participant Wallet as Wallet extension<br/>(Freighter / Albedo / xBull / Rabet)
    participant API as Creditra Backend
    participant Soroban as Soroban contract

    User->>UI: Click "Connect"
    UI->>Ctx: connect("freighter")
    Ctx->>Wallet: window.freighter.getPublicKey()
    Wallet-->>Ctx: publicKey + network
    Ctx-->>UI: status = "connected", wallet = {…}
    UI->>API: GET /risk?address=<pk>
    API-->>UI: { score, limit, lines[] }
    UI->>UI: render Dashboard / CreditLines

    User->>UI: Submit draw
    UI->>API: POST /draw (build envelope)
    API-->>UI: unsignedTxXdr
    UI->>Wallet: signTransaction(xdr)
    Wallet->>User: confirm in extension
    Wallet-->>UI: signedXdr
    UI->>Soroban: Horizon submit
    Soroban-->>API: emit event
    API-->>UI: poll → updated balance
```

### What the frontend never does

- **It never holds a secret key.** All signing happens inside the wallet extension; the
  frontend only ever sees public keys and signed XDR envelopes.
- **It never re-derives risk.** The risk score is authoritative on the backend; the UI
  renders it but cannot influence it.
- **It never trusts client time for amounts.** Validation in
  `src/utils/amountValidation.ts` is a UX guard rail only; the contract is the source of
  truth.

---

## 3. State management

The store is deliberately small. We do not use Redux, Zustand, Recoil, or React Query.

| State | Lives in | Persistence |
| --- | --- | --- |
| Wallet connection lifecycle | `src/context/WalletContext.tsx` | `localStorage` via `src/utils/wallet.ts` (`saveWalletPreference`, `getStoredWallet`) |
| Toasts and banners | `src/context/NotificationContext.tsx` | In-memory; preferences and inbox persisted to `localStorage` |
| Colour-scheme theme | `src/context/ThemeContext.tsx` | `localStorage` key `creditra-theme` via `src/utils/storage.ts` |
| High-contrast override | `src/context/ContrastContext.tsx` | `localStorage` key `creditra-contrast` via `src/utils/storage.ts` |
| Page-local form state | The page component (e.g. `pages/DrawCreditPage.tsx`) | None — destroyed on navigation |
| Wizard step | `useState` in the wizard root (`DrawCreditPage`) | URL parameters drive the success state via `useLocation().state` |

**Why no global state library?** The state graph is shallow. Wallet info, notification
queue, and UI ephemera don't share enough surface area to justify a reducer framework. The
trade-off is documented in [`docs/UX_RATIONALE.md`](UX_RATIONALE.md).

### WalletContext reducer-shaped API

`WalletContext` exposes a tiny surface:

```ts
interface WalletContextType {
  wallet: WalletInfo | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: WalletError | null;
  connect: (type: WalletType, options?: ConnectOptions) => Promise<ConnectResult>;
  disconnect: () => void;
  clearError: () => void;
}

type ConnectResult =
  | { ok: true; wallet: WalletInfo }
  | { ok: false; error: WalletConnectError };
```

`connect()` returns a result object that distinguishes success from failure. On success,
`{ ok: true, wallet }` is returned. On failure, `{ ok: false, error }` is returned and
the context's `error` and `status` fields are also updated for backward compatibility
with existing consumers.

`WalletConnectError` is a proper Error subclass (so `instanceof` checks work) with a
`type` discriminator that classifies the failure category:

```ts
class WalletConnectError extends Error {
  type: 'not_found' | 'connection_failed' | 'wrong_network' | 'user_rejected';
  message: string;
}
```

### Wallet storage (`src/utils/wallet.ts`)

`WalletContext` persists as little as possible: **only the wallet type** — never a
public key, address, key, or signature. Auto-reconnect re-derives the address from the
wallet extension via `connectWallet()`.

| Key | Value | Written when | Cleared when |
| --- | --- | --- | --- |
| `creditra-wallet-info` | `{ v: 2, type }` — the active session's wallet type | `saveWalletPreference()` after a successful connect, auto-reconnect, or `stayConnected()` | `disconnectWallet()`: explicit disconnect **and** session expiry, plus any read that finds an unusable record |
| `creditra-wallet-recent` | `WalletType[]`, most-recent last | `recordRecentWallet()` on every successful connect | `clearMRU()` only — deliberately kept across disconnect and session expiry |
| `creditra-wallet-remember` | `true` (an absent key means "no") | `setWalletRemembered(true)` when the user opts in to auto-reconnect | `setWalletRemembered(false)`, `disconnectWallet()`, session expiry |

The legacy keys `wallet_info` (v1, which did contain the public key) and
`wallet_preference` are read once by `getStoredWallet()` purely to migrate the wallet
type into `creditra-wallet-info` as `{ v: 2, type }`, after which both are deleted. The
migration is idempotent and needs no user action; a record whose type is missing or
unsupported is dropped so no reconnect is attempted from it.

Session expiry (`SESSION_TIMEOUT_MS`) is a full logout: it clears in-memory state *and*
the stored type plus the opt-in flag, so a page reload cannot silently reconnect a
session the app just ended. The MRU list survives, exactly as on an explicit disconnect,
because recency is activity history rather than session state.

### Error classification and user-facing copy

Raw errors from wallet extensions are classified by `classifyWalletError()` in
`src/utils/wallet.ts`. The helper examines error codes and messages to detect:

- **`user_rejected`** — EIP-1193 code 4001, or messages containing "reject", "decline",
  "cancel", "denied"
- **`not_found`** — messages containing "not found" or "not installed"
- **`wrong_network`** — messages containing "network", "testnet", or "mainnet"
- **`connection_failed`** — catch-all for unknown failures

Each error type maps to a user-facing message centralized in `ERROR_MESSAGES`:

| Error Type | User-Facing Copy |
| --- | --- |
| `user_rejected` | "You cancelled the request in your wallet. Try again when you're ready." |
| `not_found` | "Wallet extension not found. Please install it first." |
| `wrong_network` | "Switch your wallet to Testnet and try again." |
| `connection_failed` | "Failed to connect. Please try again." |

Raw error details are logged in development but never shown to users.

### Error propagation flow

1. **`connectWallet()`** in `src/utils/wallet.ts` throws `WalletConnectError` on failure
2. **`WalletContext.connect()`** catches errors, classifies them via
   `classifyWalletError()`, sets context state, and returns `{ ok: false, error }`
3. **`WalletButton.handleWalletConnect()`** checks the result and only opens the
   onboarding flow when `ok === true`. On failure, it re-throws the error
4. **`WalletConnectionModal.handleWalletSelect()`** catches the error, displays it in a
   `role="alert"` region, and keeps the modal open with buttons re-enabled

This ensures users are never pushed into onboarding after a failed connection, and the
modal provides actionable feedback instead of closing silently.

### NotificationContext

`NotificationContext` is more ambitious. It holds:

- `toasts` — transient stack, auto-dismissed
- `banners` — page-level alerts, persist until dismissed
- `notifications` — inbox, persisted to `localStorage` capped at 100 entries
- `preferences` — per-category mute switches (`transaction`, `credit_line`, `risk_score`,
  `rate_change`, `system`)
- `unreadCount`, `markAsRead`, `markAllAsRead`, `clearAll`
- `isPanelOpen` + open/close handlers for the `NotificationCenter`

Each notification carries a `category` so users can mute classes (e.g. silence rate-change
notifications while keeping transaction confirmations).

---

## 4. Routing

| Path | Element | Notes |
| --- | --- | --- |
| `/` | `<Dashboard />` | Default landing for a connected wallet |
| `/transactions` | `<TransactionHistory />` | Sortable, filterable ledger |
| `/credit-lines` | route is rendered in the nav but currently delegates to `pages/CreditLines.tsx`; wiring happens via `App.tsx` updates |
| `/compare-credit-lines` | `<CreditLineCompare />` | Side-by-side comparison of two credit lines. Accepts `?a=<id>&b=<id>` query params; falls back to an inline picker when params are absent or invalid. Linked from the "Full Compare →" button on `/credit-lines`. |
| `/draw-credit` | `<DrawCreditPage />` | 4-step wizard |
| `/draw-credit/success` | `<DrawCreditPage />` | Same component, success branch driven by `useLocation().state.transaction` |
| `/open-credit` | `<RequestEvaluation />` | New-applicant intake |
| `*` | `<NotFound />` | Semantic 404 with link back to `/` |

### Code-splitting

The current build emits a single bundle; the routes above are imported eagerly in
`App.tsx`. The infrastructure for per-route splitting is in place — every page is a
default-exportable component — and the recommended next step is to convert each route
import to `lazy(() => import(...))` and wrap `<Routes>` in `<Suspense fallback={<Skeleton/>}>`.
See [`PERFORMANCE.md`](PERFORMANCE.md) for the rollout plan and per-route bundle budgets.

---

## 5. Error and loading state policy

Every screen that fetches data follows the same four-state pattern:

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Empty: data.length === 0
    Loading --> Ready: data.length > 0
    Loading --> Error: fetch threw
    Error --> Loading: retry
    Empty --> Ready: data arrives
```

| State | Visual | Component |
| --- | --- | --- |
| Loading | Shimmer matching the final layout | `components/Skeleton.tsx` (`Skeleton.css` animation, `prefers-reduced-motion` disables shimmer). `TransactionHistory` uses the page-level `components/TransactionHistorySkeleton.tsx` wrapper which composes `Skeleton` into a full stats + filter + table placeholder. `RepaymentVisualizer` uses `RepaymentVisualizerSkeleton` (issue #609) for a one-frame first-paint gate that mirrors the chart card geometry. |
| Empty | Illustration + primary CTA to populate | inline per page (e.g. Dashboard's "no credit lines" state) |
| Error | Banner + retry, or full-page `ErrorBoundary` if render-time | `components/ErrorBoundary.tsx` for render errors, `BannerAlert` for fetch errors |
| Ready | Real data | the screen |

The `ErrorBoundary` lives at the very top of `App.tsx` so a panicking render anywhere in
the tree falls back to a labelled error page with a "Go back" and "Reload" pair (see
`src/pages/ErrorPage.css`).

---

## 6. Accessibility primitives

Three hooks compose to form every modal/sheet contract.

- **`useFocusTrap({ isActive, triggerRef, onEscape })`** — moves focus into the container
  on activation, cycles Tab/Shift+Tab within it, calls `onEscape` on the Escape key, and
  returns focus to `triggerRef` (or the previously focused element) on close.
- **`useBodyScrollLock({ isLocked })`** — freezes background scroll by stashing the
  scroll position into `body.style.top` and restoring it on unmount.
- **`useInertBackdrop({ isInert, modalId })`** — walks the DOM and applies the native
  `inert` attribute to every element outside the modal container; falls back to
  `aria-hidden="true"` + `pointer-events: none` for older browsers and restores prior
  attribute state on cleanup.

The `WalletConnectionModal` composes all three. Any future modal must too — failing to
do so is a review blocker.

---

## 7. Design tokens

Tokens are co-located in two places:

- **Runtime CSS variables** in `src/index.css` (`--bg`, `--surface`, `--accent`,
  `--space-*`, `--radius-*`, `--lh-*`). These are the values components read at paint
  time.
- **TypeScript token module** at `src/utils/tokens.ts`. Exports `COLOR`, `UTIL_COLOR`,
  `STATUS_COLOR`, `RISK_COLOR`, ready-made `btn` style objects, and formatters (`fmt`,
  `fmtDate`, `fmtDateTime`). Imported by inline-styled components like `Dashboard`'s
  risk gauge that need values in JS.

The Figma source-of-truth lives in [`Design System/tokens.md`](../Design%20System/tokens.md).
See [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) for the full catalogue and theming model.

---

## 8. Folder map (annotated)

```
src/
├── App.tsx              Routes + global providers (ErrorBoundary > WalletProvider > Router)
├── main.tsx             ReactDOM bootstrap inside StrictMode
├── index.css            Token definitions + base styles + utility classes
├── pages/               Route-level components
│   ├── Dashboard.tsx        Risk gauge, summary, recent tx
│   ├── CreditLines.tsx      Sortable credit-line list
│   ├── DrawCreditPage.tsx   4-step draw wizard
│   ├── TransactionHistory.tsx
│   ├── RequestEvaluation.tsx
│   ├── NotFound.tsx
│   └── (auth) LoginPage / RegisterPage / ForgotPasswordPage / ResetPasswordPage
├── components/
│   ├── notifications/   ToastContainer, BannerAlert, NotificationBell, NotificationCenter
│   ├── (modals)         WalletConnectionModal, RepayModal, OnboardingFlow
│   ├── (inputs)         FormField, FormMessage, AmountInput, PendingButton
│   ├── (status)         StatusBadge, Skeleton, TransactionHistorySkeleton, SuccessState, TransactionStatus, RiskGauge
│   ├── (a11y)           AccessibleTooltip, CopyToClipboard
│   └── ErrorBoundary    Top-level render-error catcher
├── context/
│   ├── WalletContext.tsx
│   └── NotificationContext.tsx
├── hooks/
│   ├── useFocusTrap.ts
│   ├── useBodyScrollLock.ts
│   ├── useInertBackdrop.ts
│   └── useScrollRestoration.ts   — saves/restores scrollY per route
├── utils/
│   ├── tokens.ts        Color/spacing tokens + formatters
│   ├── wallet.ts        Wallet provider glue
│   ├── amountValidation.ts  Draw/repay input validation
│   ├── currency.ts / dates.ts / format-address.ts
│   ├── classnames.ts / clipboard.ts / storage.ts / password-strength.ts
├── types/
│   ├── wallet.ts / creditLine.ts / draw-credit.types.ts / notification.ts / auth.types.ts
├── lib/                 External adapters and mock data
├── data/                Static fixtures (mirrors backend shape)
└── test/                Vitest setup
```
