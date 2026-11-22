# Repayment Schedule Visualizer

> Added in [Issue #428](#428 "Add repayment schedule visualizer") for the GrantFox FWC26 campaign.

A vertical, accessible timeline of past installments and forward-looking
payments for a credit line (or aggregated across many credit lines). The
component is the canonical visual treatment for "what are my upcoming
repayments and when do I owe them?" inside the Creditra front-end.

---

## Live demo

Start the dev server:

```sh
npm run dev
```

Then visit **http://localhost:5173/credit-lines** — the schedule sits below
the credit-line card grid. Update the status filter to see the timeline
respond to each subset.

## Component contract

```ts
import {
  RepaymentSchedule,
  buildRepaymentScheduleFromLine,
  buildRepaymentScheduleFromLines,
  deriveStatus,
} from './components/RepaymentSchedule';
```

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `schedule` | `ScheduledRepayment[]` | required | Defensively re-sorted ascending by `dueDate`. |
| `title` | `string` | `"Repayment Schedule"` | Heading shown above the timeline. |
| `compact` | `boolean` | `false` | Reduces spacing for dense embeds. |
| `loading` | `boolean` | `false` | Skeleton placeholder; the supplied `schedule` is ignored. |
| `headingId` | `string` | generated | Exposed for `aria-labelledby` overrides. |
| `now` | `Date` | `new Date()` | Reference clock for "Today" detection. Pass a fixed value from tests. |

### Status taxonomy

| Status | Trigger | Visual cue |
| --- | --- | --- |
| `paid` | Installment already settled (has `paidDate` + optional `txHash`). | Filled green bullet `✓` + success badge + settled date + tx hash. |
| `upcoming` | Due within the next 7 days. | Filled blue bullet `●` + accent badge + 3px accent left-border. |
| `scheduled` | Due more than 7 days in the future. | Dashed grey bullet `○` + muted badge. |
| `overdue` | 1–90 days past due. | Filled amber bullet `!` + warning badge + 3px warning left-border. |
| `defaulted` | More than 90 days past due. | Filled red bullet `⚠` + error badge + 3px error left-border. |

Each status is a discriminated union member, so TypeScript narrows on
`paid` (which carries `paidDate` / `txHash`) versus the others. A compile-time
`assertNever` guard lives in the render path so adding a new status requires
updating `STATUS_LABEL` / `STATUS_GLYPH` / CSS / the render exit branch —
otherwise the build fails.

## Helpers exported

- `buildRepaymentScheduleFromLine(line, now?, additionalScheduledCount?)`
  - Consumes a single `CreditLine` and returns a sorted `ScheduledRepayment[]`.
  - Coalesces `Repay` + `Interest` ledger rows that landed on the same
    calendar day into a single combined `paid` entry.
  - Synthesises up to `additionalScheduledCount` future installments beyond
    `nextPaymentDate` so the user sees the shape of cashflow, not just one
    horizon point.

- `buildRepaymentScheduleFromLines(lines, now?)`
  - Merges the per-line schedules into a single chronologically sorted
    array. Used by the Credit Lines page aggregate section.

- `deriveStatus(dueDateIso, now?)`
  - Pure helper. Classifies a single due-date as `upcoming` / `scheduled`
    / `overdue` / `defaulted` based on elapsed days. 7-day "soon" window,
    90-day defaulting threshold.

## Accessibility (WCAG 2.1 AA)

| Criterion | Implementation |
| --- | --- |
| 1.3.1 Info and Relationships | `<section>` landmark + `<ol>` of `<li>`s + `<time dateTime>` for every due-date and paid-date. |
| 1.4.1 Use of Color | Status is conveyed via **three independent channels** — badge color, badge glyph (`✓ ● ○ ! ⚠`), badge text label ("Paid", "Due soon", "Scheduled", "Overdue", "Defaulted"). |
| 1.4.3 Contrast | All colors come from CSS custom properties in `src/index.css :root`; high-contrast mode overrides are scoped under `[data-contrast="high"]`. |
| 1.4.11 Non-text Contrast | Rows with non-neutral status receive an additional 3px left border in their status token color — a non-text indicator. |
| 1.4.13 Content on Hover or Focus | Tooltips not used; badges use plain text so no hover state is required. |
| 2.1.1 Keyboard | The scrollable list region is `tabIndex={0}` and focusable so keyboard users can scroll the timeline on mobile. |
| 2.4.6 Headings and Labels | Region labelled by the section heading via `aria-labelledby`. |
| 2.5.3 Label in Name | Visible "Paid"/"Due soon"/etc. word is mirrored inside the badge `aria-label` ("Status: Paid"), so accessible-name == visible-label. |
| 4.1.2 Name, Role, Value | Each `<li>` has a context-rich `aria-label` describing amount + due-date + status, e.g. `"Due soon installment of $3,200 due Mar 20, 2025 on Primary Business Line"`. |

### Reduced motion

The global rule in `src/index.css` neutralises all entrance / hover
transitions under `prefers-reduced-motion: reduce`. The skeleton pulse
animation is additionally short-circuited in `RepaymentSchedule.css` so the
placeholder doesn't strobe for users who've asked for less motion.

### High-contrast

High-contrast palette tokens (`--success`, `--warning`, `--error`, etc.)
are re-declared under `[data-contrast="high"]` in `src/index.css` and
automatically flow through the schedule. The overdue `bullet` and `row`
explicitly swap to `--error` in high-contrast mode so the worst state
remains maximally visible.

## Responsive behaviour

| Breakpoint | Layout |
| --- | --- |
| `≥ 720px` | 4-column summary strip, full-width timeline, side-by-side bullet/date/badge row. |
| `480–720px` | 2-column summary, single-column timeline. |
| `< 480px` | Compact padding, reduced bullet size, bottom-of-row stacked principal/interest. |

The vertical timeline rail is always present so the chronology is legible
even when the row content is collapsed.

## Data model

```ts
export type RepaymentStatus =
  | 'paid'
  | 'upcoming'
  | 'scheduled'
  | 'overdue'
  | 'defaulted';

interface ScheduledRepaymentBase {
  id: string;            // stable React key + dedupe id
  dueDate: string;       // ISO 8601 YYYY-MM-DD or full ISO timestamp
  amount: number;        // total USD (principal + interest)
  principal: number;     // USD applied to principal
  interest: number;      // USD applied to interest
  note?: string;
  lineId?: string;       // required for aggregate views
  lineName?: string;
}

export type ScheduledRepayment = ScheduledRepaymentBase &
  (
    | { status: 'paid'; paidDate: string; txHash?: string }
    | { status: 'upcoming' | 'scheduled' | 'overdue' | 'defaulted' }
  );
```

`ScheduledRepayment` is exported, so callers can construct entries
manually for SSR / static rendering or for unit tests. The synthesis
helpers above are a convenience, not a requirement.

## Visual changes (visible in app)

| Surface | Before | After |
| --- | --- | --- |
| `/credit-lines` page | Credit-line cards only. | Adds a **Repayment Schedule** section beneath the card grid: aggregate, chronological timeline of all past + future installments across the user's lines. |
| `/dashboard` summary | n/a | Unchanged in this PR (schedule is data-aggregatable via `buildRepaymentScheduleFromLines` for future dashboards). |

## Files added / modified

| File | Change |
| --- | --- |
| `src/components/RepaymentSchedule.tsx` | New component + types + helpers. |
| `src/components/RepaymentSchedule.css` | New styles for the timeline (uses design tokens). |
| `src/components/__tests__/RepaymentSchedule.test.tsx` | New focused tests — 32 cases. |
| `src/pages/CreditLines.tsx` | Wraps `<RepaymentSchedule />` at the bottom of the card grid. |
| `src/pages/CreditLines.css` | Adds `.cl-repayment-schedule` / `.cl-section-title` wrapper classes. |
| `docs/REPAYMENT_SCHEDULE.md` | This document. |

## Known constraints

The existing repo has pre-existing TypeScript mismatches in
`src/App.tsx`, `src/pages/Dashboard.tsx`, and `src/pages/DutchAuctions.tsx`.
Those existed before this PR and are out of scope. This PR does not
introduce new tsc errors and all 32 focused tests for
`RepaymentSchedule` pass.

The repo does not currently ship an `.eslintrc*` or
`eslint.config.*`, so `npm run lint` runs an ESLint v10 downloaded via npx
that errors on legacy config. The Reviewer PR should mention this as a
known gap to be addressed separately.

## Test coverage

`src/components/__tests__/RepaymentSchedule.test.tsx` covers:

- chronological ordering (sort enforced both at helper and component)
- empty state, loading state, single-installment state
- status badges (`Paid` / `Due soon` / `Scheduled` / `Overdue` /
  `Defaulted`) — each has both an icon glyph AND a textual label
- `<time dateTime>` placement so screen readers parse dates correctly
- principal/interest split with per-piece aria-labels
- on-chain transaction hash surface for paid entries
- aggregate summary stats (paid total, remaining total, upcoming,
  overdue counts) and the alert-only-when-overdue styling rule
- today pill detection (with `now={FROZEN_NOW}` for determinism)
- no inline hex — every color is a CSS custom property token
- keyboard focusable scrollable list region
- accessible region landmark via `aria-labelledby`
- helper-level tests for `deriveStatus`, `buildRepaymentScheduleFromLine`
  (coalesce same-day Repay + Interest; classify upcoming / overdue /
  defaulted / scheduled; honour `additionalScheduledCount`; stable ids),
  and `buildRepaymentScheduleFromLines` (sort + line attribution + empty
  input)
