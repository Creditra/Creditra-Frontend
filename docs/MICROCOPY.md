# Microcopy Guide

This document centralizes definitions and style guidelines for financial terms and copy used throughout the Creditra platform. When these terms appear in user interfaces, they should ideally be wrapped in the `InlineTermTooltip` component to provide inline contextual help.

Short, scannable text that helps users understand what they're looking at and what to do next. Every sentence should earn its place.

## Tone

- **Direct** — say what the number means, don't bury it. Use clear, actionable language.
- **Neutral** — inform without alarming. A low score is a signal, not a judgment.
- **Actionable** — if there's something the user can do, tell them.
- **No jargon without context** — "utilization" is fine in a label; "delinquency ratio" is not. Where technical terms must be used, provide an `InlineTermTooltip`.

## Risk-explainer sentences

One sentence per band, derived from `RISK_COLOR(score)`:

| Band        | Threshold | Message |
|-------------|-----------|---------|
| success     | >= 700    | Strong credit position — you're above the recommended threshold for new draws. |
| warning     | >= 600    | Fair credit position — within acceptable range, though keep an eye on your utilization. |
| danger      | < 600     | Below the recommended threshold — consider improving your score before new draws. |

## Dismiss label

`Dismiss risk score explainer`

## On-chain draw settlement

When a draw has a transaction hash, say it is confirmed on the Stellar ledger
and that funds are available once the transaction settles; avoid guaranteeing
a settlement time. Without a transaction hash, use `Waiting for ledger confirmation.`

---

## Glossary

Every term that appears in the UI should be used consistently. When a term needs an inline gloss, the gloss text below is canonical.

| Term | Canonical label | Gloss definition (for AccessibleTooltip & InlineTermTooltip) | Do use | Don't use |
|------|----------------|-------------------------------------------|--------|-----------|
| Draw | Draw amount | A draw is the amount of credit you choose to receive from your available credit line. | "Draw amount", "draw from your credit line" | "credit event", "loan disbursement" |
| Repay | Repayment amount | A repayment reduces your outstanding balance and frees up available credit. | "Repayment amount", "repay", "outstanding debt" | "paydown", "debt settlement" |
| Utilization | Utilization | Utilization is the percentage of your available credit that is currently being used. Low utilization (under 30%) is generally considered good. | "Utilization", "credit utilization" | "balance ratio", "usage rate" |
| Reserve | Reserve | A reserve is the portion of your credit line that should stay untouched for safety and flexibility. | "Reserve", "wallet reserve", "credit reserve" | "minimum floor", "buffer" |
| APR | APR | APR (Annual Percentage Rate) is the yearly cost of borrowing, including fees and interest. | "APR", "annual percentage rate" | "interest rate" (when APR is meant) |
| Attestation | Attestation | An attestation is a cryptographically signed statement that verifies your identity or credit data. | "Attestation", "verify" | "certification", "notarization" |
| Term | Term | A term is a defined period or condition of your credit agreement. | "Term", "terms and conditions" | "tenor", "covenant" |
| Healthy | Healthy | Healthy means your credit position is strong and within the recommended thresholds. | "Healthy", "strong credit position" | "good", "excellent" (use numeric score instead) |
| Credit Limit | Credit Limit | The maximum amount of credit that a financial institution extends to a client through a line of credit. | "Credit Limit" | "Max limit", "Borrowing cap" |
| Default | Default | Failure to repay a debt including interest or principal on a loan or security. | "Default" | |
| Dutch Auction| Dutch Auction | A public offering auction structure in which the price of the offering is set after taking in all bids to determine the highest price at which the total offering can be sold. | "Dutch Auction" | |

## Landing Page Hero CTA Variants

The landing hero copy is managed in `src/copy/landing.ts` with deterministic A/B variant selection per session (seeded by date).

| Variant | Title | Subtitle | Primary CTA | Secondary CTA | Intent |
|---------|-------|----------|-------------|---------------|--------|
| `control` | Adaptive Credit Without Overcollateralization | Credit limits that evolve with your on-chain behavior. No locked capital. No static risk models. Just programmable credit. | Connect Wallet | Learn More | Current baseline — emphasizes absence of collateral requirement |
| `variant_a` | Credit That Grows With You — No Collateral Needed | Your on-chain history powers a living credit limit. No lockup, no static model — just capital that adapts to how you build. | Get Started | See How It Works | Growth-focused — positions credit as an evolving resource |
| `variant_b` | Unlock On-Chain Credit Without Locking Assets | Behavior-based lending powered by Stellar smart contracts. Your activity defines your limit — not your collateral. | Claim Your Credit | Explore the Protocol | Action-oriented — frames credit as an unlockable asset |

Selection is deterministic: `getVariant()` hashes the current date (YYYY-MM-DD) and selects a variant via modulo. The same user on the same day always sees the same variant.

To add a new variant:
1. Add the id to `VariantId` type in `src/copy/landing.ts`
2. Add the copy to `HERO_VARIANTS` record
3. Document the variant in this table

## Label conventions

| Label | Canonical phrasing | Context |
|-------|--------------------|---------|
| Available credit (not "Available limit") | "Available credit" | The portion of the credit line still accessible for draws. |
| Remaining credit (not "Remaining") | "Remaining credit" | What would be left after a draw. |
| Outstanding debt (not "Current Debt") | "Outstanding debt" | The total amount owed on a credit line including accrued interest. |
| Minimum draw / Minimum repayment | "Minimum draw", "Minimum repayment" | The floor for an action. |
| Wallet reserve | "Wallet reserve" | The portion of wallet balance to keep untouched. |
| Utilization after draw / after repayment | "Utilization after draw", "Utilization after repayment" | Projected utilization post-action. |
