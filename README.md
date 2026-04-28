# Creditra Frontend

Lender and borrower dashboard for the Creditra adaptive credit protocol on Stellar.

## About

This app provides a simple UI to:

- **Connect Stellar wallet** (Freighter, Albedo) with secure onboarding
- View dashboard summary (credit limit, utilization, risk score)
- Browse and manage credit lines
- (Future) Request credit evaluation, draw and repay

It talks to the **creditra-backend** API for risk and credit data, and can be extended to interact with Soroban contracts via Stellar SDK.

## ✨ New: Wallet Connection & Onboarding

**Complete wallet integration with:**

- 🔗 Connect Freighter, Albedo, xBull, or Rabet wallets
- 👋 First-time user onboarding (3-step flow)
- ✅ Connection status indicators
- ⚠️ Comprehensive error handling
- 💾 Persistent wallet preference
- 🔒 Security-first design

**Quick Start**: See [WALLET_SETUP.md](WALLET_SETUP.md) for details.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** for build and dev server
- **React Router** for navigation
- **Context API** for state management

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Install and run

```bash
cd creditra-frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## 🛠️ Contributing UI Changes

To maintain high UX quality, all UI changes must pass an accessibility review. Include this checklist in your Pull Request:

```markdown
### ♿ Accessibility Check

- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators are clearly visible
- [ ] Contrast ratios meet WCAG AA (4.5:1)
- [ ] Semantic HTML and ARIA labels are used
- [ ] `prefers-reduced-motion` is respected
```

See the full [Accessibility Checklist](CHECKLIST.md) for detailed guidance.

### Build for production

```bash
npm run build
npm run preview   # serve dist/
```

### Environment

Create a `.env` file if you need to point to a specific backend:

```env
VITE_API_URL=http://localhost:3000
```

Use `import.meta.env.VITE_API_URL` in the app.

## Project layout

- `src/` — React app (main, App, pages, components, context)
- `src/components/` — Reusable UI components (WalletConnectionModal, OnboardingFlow, WalletButton)
- `src/context/` — Global state management (WalletContext)
- `src/pages/` — Dashboard, Credit Lines
- `src/types/` — TypeScript type definitions
- `src/utils/` — Utility functions (wallet integration)
- `index.html` — entry HTML
- `vite.config.ts` — Vite config and path alias `@/`

## Documentation

- **[WALLET_SETUP.md](WALLET_SETUP.md)** - Quick start guide for wallet feature
- **[WALLET_IMPLEMENTATION.md](WALLET_IMPLEMENTATION.md)** - Complete technical documentation
- **[USER_FLOWS.md](USER_FLOWS.md)** - User flow diagrams
- **[COMPONENT_SPECS.md](COMPONENT_SPECS.md)** - Design specifications
- **[VISUAL_STATES.md](VISUAL_STATES.md)** - UI state mockups
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Project overview

## Merging to remote

This repo is a standalone git repository. After adding your remote:

```bash
git remote add origin <your-creditra-frontend-repo-url>
git push -u origin main
```
