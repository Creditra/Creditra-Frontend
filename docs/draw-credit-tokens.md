# DrawCreditPage — Design Token Changelog (v7)

> **Issue:** #586 · **Branch:** `task/drawcreditpage-tokens-v7`  
> **Campaign:** GrantFox FWC26 — Stellar Wave  
> **Date:** 2026-07-24

---

## Overview

This document records every spacing, colour, and typography change made during
the v7 token-audit of the `DrawCreditPage` flow. Before this change the draw-
credit components contained hard-coded Tailwind colour utilities that bypassed
the project's design-token layer (`src/index.css :root`). All such values have
now been replaced with references to CSS custom properties via semantic
`dc-*` utility classes.

---

## New Tokens Added to `:root` (`src/index.css`)

### Colour Alpha Variants

These were implicit in the old code (e.g. `bg-blue-500/10` → 10% opacity of
blue-500). They are now named tokens so a single edit propagates everywhere.

| Token | Value | Replaces |
|---|---|---|
| `--accent-tint` | `rgba(88, 166, 255, 0.12)` | `bg-blue-500/10`, `bg-primary/20` |
| `--accent-border` | `rgba(88, 166, 255, 0.30)` | `border-blue-500/30`, `border-t-primary` |
| `--success-tint` | `rgba(63, 185, 80, 0.12)` | `bg-green-500/10` |
| `--success-border` | `rgba(63, 185, 80, 0.30)` | `border-green-500/30`, `border-2 border-green-500/30` |
| `--warning-tint` | `rgba(210, 153, 34, 0.12)` | `bg-yellow-500/10` |
| `--warning-border` | `rgba(210, 153, 34, 0.30)` | `border-yellow-500/30` |
| `--error-tint` | `rgba(248, 81, 73, 0.12)` | `bg-destructive/10`, `bg-red-500/10` |
| `--error-border` | `rgba(248, 81, 73, 0.30)` | `border-destructive/30`, `border-red-500/30` |

### Spacing Scale

| Token | Value | Notes |
|---|---|---|
| `--space-1` | `0.25rem` | 4 px |
| `--space-2` | `0.5rem` | 8 px |
| `--space-3` | `0.75rem` | 12 px |
| `--space-4` | `1rem` | 16 px |
| `--space-5` | `1.25rem` | 20 px |
| `--space-6` | `1.5rem` | 24 px |
| `--space-8` | `2rem` | 32 px |
| `--space-10` | `2.5rem` | 40 px |
| `--space-12` | `3rem` | 48 px |

### Border-Radius Scale

| Token | Value | Notes |
|---|---|---|
| `--radius-sm` | `0.375rem` | 6 px |
| `--radius-md` | `0.5rem` | 8 px |
| `--radius-lg` | `0.75rem` | 12 px |
| `--radius-xl` | `1rem` | 16 px |
| `--radius-full` | `9999px` | circles, pills |

### Typography Scale

| Token | Value | Notes |
|---|---|---|
| `--text-xs` | `0.75rem` | 12 px |
| `--text-sm` | `0.875rem` | 14 px |
| `--text-base` | `1rem` | 16 px |
| `--text-lg` | `1.125rem` | 18 px |
| `--text-xl` | `1.25rem` | 20 px |
| `--text-2xl` | `1.5rem` | 24 px |
| `--text-3xl` | `1.875rem` | 30 px |
| `--font-medium` | `500` | |
| `--font-semibold` | `600` | |
| `--font-bold` | `700` | |
| `--leading-tight` | `1.25` | |
| `--leading-normal` | `1.5` | |

---

## Token Substitution Map

The table below is a full audit of every hard-coded value replaced in this PR.

### Colour substitutions

| Old Tailwind class | Replaced by | Token used |
|---|---|---|
| `bg-primary/20` | `dc-spinner-ring-bg` | `var(--accent-tint)` |
| `border-t-primary` | `dc-spinner-ring` | `var(--accent)` |
| `bg-blue-600` | `dc-btn--primary` | `var(--accent)` |
| `hover:bg-blue-500` | `dc-btn--primary:hover` | `color-mix(in srgb, var(--accent) 85%, #fff)` |
| `hover:shadow-blue-500/40` | `dc-btn--primary:hover` | `var(--accent-border)` |
| `hover:border-blue-400` | `dc-credit-line-item:hover`, `dc-preset-btn:hover` | `var(--accent)` |
| `text-blue-400` | `dc-stat-card--accent .dc-stat-card__value` | `var(--accent)` |
| `text-blue-500` | `dc-status-icon--accent` | `var(--accent)` |
| `bg-blue-500` (progress) | `dc-progress-bar` | `var(--accent)` |
| `bg-blue-500/10` | `dc-stat-card--accent` | `var(--accent-tint)` |
| `border-blue-500/30` | `dc-stat-card--accent` | `var(--accent-border)` |
| `bg-blue-500/10` (status) | `dc-status-icon-bg--accent` | `var(--accent-tint)` |
| `text-green-400` | `dc-stat-card--success .dc-stat-card__value` | `var(--success)` |
| `text-green-500` | `dc-status-icon--success`, `dc-success-notice p` | `var(--success)` |
| `bg-green-500/10` | `dc-stat-card--success`, `dc-status-icon-bg--success`, `dc-success-notice` | `var(--success-tint)` |
| `border-green-500/30` | `dc-stat-card--success`, `dc-success-notice` | `var(--success-border)` |
| `text-yellow-500` | `dc-credit-line-item__value--warning`, `dc-util-row__value--warning`, `dc-banner--warning .dc-banner__title` | `var(--warning)` |
| `bg-yellow-500` (progress) | `dc-progress-bar--warning` | `var(--warning)` |
| `bg-yellow-500/10` | `dc-banner--warning` | `var(--warning-tint)` |
| `border-yellow-500/30` | `dc-banner--warning` | `var(--warning-border)` |
| `text-red-500` | `dc-status-icon--error` | `var(--error)` |
| `bg-red-500/10` | `dc-status-icon-bg--error` | `var(--error-tint)` |
| `text-destructive` | `dc-banner--error` text | `var(--error)` |
| `bg-destructive/10` | `dc-banner--error` | `var(--error-tint)` |
| `border-destructive/30` | `dc-banner--error` | `var(--error-border)` |

### Spacing / layout substitutions

| Old class | Replaced by | Token |
|---|---|---|
| `space-y-8` | `dc-step` (gap) | `var(--space-8)` |
| `space-y-6` | `dc-step` inner | `var(--space-6)` |
| `space-y-4` | `dc-balance-card` | `var(--space-4)` |
| `p-8` (spinner bg) | `dc-spinner-ring-bg` | `var(--space-8)` |
| `p-5` (cards) | `dc-balance-card`, `dc-credit-line-item` | `var(--space-5)` |
| `p-4` | `dc-page__card`, `dc-terms-label` | `var(--space-4)` |
| `p-3` | `dc-banner`, `dc-preset-btn` | `var(--space-3)` |
| `mt-8` (footer) | `dc-page__footer` | `var(--space-8)` |
| `gap-4` | `dc-stat-grid` | `var(--space-4)` |
| `gap-3` | `dc-credit-line-list` | `var(--space-3)` |
| `gap-2` | `dc-presets` | `var(--space-2)` |
| `pt-8` (separator) | `dc-separator` | `var(--space-8)` |
| `py-3 px-4` (buttons) | `dc-btn` | `var(--space-3) var(--space-4)` |

### Inline style removal

| Before | After |
|---|---|
| `<div style={{ maxWidth: 'none', margin: 0 }}>` on the card | Removed; `dc-page__card` handles layout via tokens |

---

## Visible / API Changes

### Component changes (no breaking changes to props)

| Component | Visible change |
|---|---|
| `DrawCreditPage` | Removed `"use client"` directive (unused Next.js remnant in a Vite SPA). No functional change. |
| `DrawCreditPage` | Loading spinner now centred via `dc-spinner-wrap` instead of `space-y-8 text-center`. |
| `CreditLineSelector` | Credit-line list is now a semantic `<ul>/<li>` (improves AT navigation). |
| `AmountInput` | Error banner style changed from inline styles to `dc-banner--error` class — same visual result via token. |
| All buttons | Focus ring uses `var(--accent)` (was `ring-blue-400` / `ring-blue-300`) — same colour, now token-backed. |

### Accessibility improvements (WCAG 2.1 AA)

| Fix | Location | WCAG criterion |
|---|---|---|
| Added `role="status"` + `aria-live="polite"` + `aria-label="Processing your draw request"` | DrawCreditPage loading spinner | 4.1.3 Status Messages |
| Added `role="status"` on `aria-live="polite"` to transaction result | TransactionStatus | 4.1.3 Status Messages |
| Error banner uses `role="alert"` | AmountInput, ConfirmationStep | 4.1.3 Status Messages |
| `aria-disabled` mirrors `disabled` on action buttons | AmountInput, ConfirmationStep | 4.1.2 Name, Role, Value |
| Credit-line list uses `<ul role="list">` / `<li>` | CreditLineSelector | 1.3.1 Info and Relationships |
| Progress bars have `aria-label` describing the line name + percentage | CreditLineSelector, PreviewSection | 1.1.1 Non-text Content |
| Reduced-motion: static clock icon replaces `dc-spinner-ring`; CSS kills `fadeInUp` / `dc-spin` under `prefers-reduced-motion` and `[data-motion="reduced"]` | DrawCreditPage + `DrawCreditPage.css` | 2.3.3 Animation from Interactions |
| Keyboard-only `:focus-visible` rings for wizard controls (credit lines, presets, buttons, terms checkbox, AmountInput steppers, Contact support) | `src/styles/focus.css` + `DrawCreditPage` `.focus-ring` | 2.4.7 Focus Visible |

---

## Dark-Mode Behaviour

All tokens are defined in `:root` without a `@media (prefers-color-scheme: dark)` guard because the design system is **dark-first** — the base palette is already the dark palette. A future light-mode pass would add a `[data-theme="light"]` override block to `:root`; no draw-credit component changes would be needed.

---

## Files Changed

```
src/index.css                                ← token extensions + dc-* classes
src/pages/DrawCreditPage.tsx                 ← token pinning + a11y fixes
src/components/CreditLineSelector.tsx        ← token pinning
src/components/AmountInput.tsx               ← token pinning
src/components/PreviewSection.tsx            ← token pinning
src/components/ConfirmationStep.tsx          ← token pinning
src/components/TransactionStatus.tsx         ← token pinning
src/pages/DrawCreditPage.test.tsx            ← NEW: 11-case focused test suite
docs/draw-credit-tokens.md                   ← NEW: this document
```
