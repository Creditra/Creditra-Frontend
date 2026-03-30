# Design Tokens Documentation

## Figma Source

- Token library section: [CREDITRA DESIGN SYSTEM - Design Tokens](https://www.figma.com/design/sdRDpwLg8dzX4UMT7U9u6O/CREDITRA-DESIGN-SYSTEM?node-id=4004-4455&t=A3GYaMwKM39Doxms-11)
- Figma file key: `sdRDpwLg8dzX4UMT7U9u6O`
- Section node: `4004:4455`
- Section name in Figma: `Design tokens`

## Purpose

This page is the foundation layer of the Creditra design system. While the component page shows reusable interface patterns, the tokens page defines the raw visual values those components should be built from.

The token page exists to make styling decisions repeatable and scalable. It helps designers and developers:

- use the same color values across the product
- align light and dark UI surfaces
- apply consistent elevation and shadow behavior
- avoid one-off visual decisions at screen level
- turn design values into reusable engineering primitives

In practical terms, this page is the source of truth for the smallest reusable visual decisions in the system.

## What Design Tokens Mean In This System

A design token is a named visual value that can be reused across many components and screens. Instead of hardcoding a color, shadow, radius, or spacing value directly into every interface, the system defines it once and reuses it through semantic naming.

Typical benefits of working this way:

- consistency across screens
- faster design iteration
- easier theming and brand updates
- better alignment between design and code
- fewer visual regressions

This tokens page is therefore more than a palette board. It is the visual vocabulary used by the rest of the design system.

## Page Structure

The linked Figma section is a wide, multi-column token board. From the visible structure and metadata, the page includes at least:

1. Primitive color scales
2. Additional token reference sections beyond color
3. Effect tokens, especially shadow tokens

The board appears to be organized as separate token families placed side by side, each showing:

- token name
- sample or swatch
- resolved value
- in some cases, code-friendly naming

This layout is useful because it lets the team inspect both the human meaning and the exact implementation value of each token.

## Confirmed Token Families

### 1. Primitive Color Tokens

The most clearly defined section in the linked node is `primitives-colour`. This section shows several color families with stepped values.

Confirmed visible color families include:

- `rich-black`
- `black`
- `grey`
- `blue`
- `green`

Each family is structured using a five-step scale:

- `50`
- `100`
- `200`
- `300`
- `400`
- `500`

This tells us the system is not using a single flat color per hue. Instead, it provides graduated tonal ranges that can support hierarchy, surface separation, states, and emphasis.

### 2. Effect Tokens

The metadata also confirms a dedicated effect-token area focused on shadows.

Confirmed visible effect tokens include:

- `Shadow Small` with code label `.shadow-sm`
- `Shadow Medium` with code label `.shadow-md`
- `Shadow Large` with code label `.shadow-lg`
- `Shadow Extra Large` with code label `.shadow-xl`
- `Shadow None` with code label `.shadow-none`

This means shadow styling is being standardized rather than improvised at component level. That is a strong signal of a system designed for scalable surface layering and overlay behavior.

### 3. Additional Token Families

The Figma board is visibly broader than the two areas confirmed above. The screenshot suggests additional token columns and reference panels beyond primitive colors and shadows.

Because the exposed metadata is partial, this document only states with confidence what is directly visible and confirmed. As the token library is expanded or queried more deeply, this file should be updated with the exact names of those additional families.

## Primitive Color System

### Why Primitive Colors Matter

Primitive colors are the raw palette values of the system. They are not yet tied to usage meaning like `text-primary` or `surface-muted`. Instead, they represent foundational color values that semantic tokens can later reference.

This separation is important because:

- the same primitive can support multiple semantic uses
- semantics can change without rebuilding the palette
- themes can be updated more safely
- components stay linked to intent rather than hardcoded values

## Confirmed Primitive Color Scales

### Rich Black

Visible scale values:

- `rich-black/50`
- `rich-black/100`
- `rich-black/200`
- `rich-black/300`
- `rich-black/400`
- `rich-black/500`

Observed values from Figma:

- `50`: `#d0d0d1`
- `100`: `#898a8c`
- `200`: `#626466`
- `300`: `#3a3d3f`
- `400`: `#131619`
- `500`: `#040405`

Usage interpretation:

- lighter steps can support borders, low-emphasis text, or muted surfaces in dark contexts
- darker steps can support backgrounds, high-contrast panels, and base dark-theme surfaces

### Black

Visible scale values:

- `black/50`
- `black/100`
- `black/200`
- `black/300`
- `black/400`
- `black/500`

Observed values from Figma:

- `50`: `#eff0f0`
- `100`: `#d6d7d8`
- `200`: `#787a7d`
- `300`: `#34383c`
- `400`: `#232528`
- `500`: `#0a0b0c`

Usage interpretation:

- this family appears to offer a separate neutral ladder from `rich-black`
- it may be intended for balanced UI neutrals rather than the deepest background treatment

### Grey

Visible scale values:

- `grey/50`
- `grey/100`
- `grey/200`
- `grey/300`
- `grey/400`
- `grey/500`

Observed values from Figma:

- `50`: `#e8eaeb`
- `100`: `#c6c9cd`
- `200`: `#8e949b`
- `300`: `#5f6367`
- `400`: `#2f3134`
- `500`: `#1c1e1f`

Usage interpretation:

- grey likely serves as the system’s most flexible neutral family
- it can support borders, disabled states, muted text, dividers, and secondary surfaces

### Blue

Visible scale values:

- `blue/50`
- `blue/100`
- `blue/200`
- `blue/300`
- `blue/400`
- `blue/500`

Observed values from Figma:

- `50`: `#deedff`
- `100`: `#abd2ff`
- `200`: `#58a6ff`
- `300`: `#3b6faa`
- `400`: `#1d3755`
- `500`: `#122133`

Usage interpretation:

- this appears to be the primary brand-accent family
- `blue/200` is especially important because it reads like the main actionable accent in the current product UI
- lighter tones likely support tints, selected states, and informative backgrounds
- darker tones likely support pressed states, dark surfaces, and contrast-safe variants

### Green

Visible scale values:

- `green/50`
- `green/100`
- additional values are visibly present in Figma, though the exposed metadata is truncated before all exact hex values are shown in the tool response

Observed values from Figma:

- `50`: `#d9f1dc`
- `100`: `#9fdca7`

Usage interpretation:

- green is likely the success or positive-outcome family
- expected uses include confirmations, positive metrics, successful transactions, and health states

## Reading The Scale Pattern

Across the visible palette families, the system follows a consistent stepped pattern. That consistency matters because it suggests the team intends to:

- choose from predictable tonal ladders
- maintain similar contrast logic across different hues
- build semantic tokens on top of structured base values

A practical reading of the scale:

- `50` and `100`: light tints and subtle backgrounds
- `200`: main usable mid-tone for emphasis or action
- `300`: stronger tone or deeper support color
- `400` and `500`: dark forms of the hue for contrast-heavy surfaces or dark UI usage

That interpretation should still be validated against semantic token definitions, but it is a useful mental model for working with the board.

## Effect Tokens

### Role Of Effect Tokens

Effect tokens standardize how depth is represented in the interface. Without them, cards, dialogs, popovers, and overlays often drift into inconsistent shadow behavior.

This board confirms that Creditra is systematizing shadow use instead of leaving it component-by-component.

### Confirmed Shadow Tokens

The visible shadow scale includes:

- `Shadow None`
- `Shadow Small`
- `Shadow Medium`
- `Shadow Large`
- `Shadow Extra Large`

Visible code-oriented labels include:

- `.shadow-none`
- `.shadow-sm`
- `.shadow-md`
- `.shadow-lg`
- `.shadow-xl`

### Observed Value Pattern

Visible examples from the board show shadow values described in multiple formats:

- hex with alpha
- `rgba(...)`
- `hsla(...)`

Examples visible in the section include:

- `#0000000D rgba(0, 0, 0, 5%) hsla(0, 0, 0, 5%)`
- `#0000001A rgba(0, 0, 0, 10%) hsla(0, 0, 0, 10%)`
- `#000000 rgba(0, 0, 0, 0%) hsla(0, 0, 0, 0%)`

This indicates the shadow tokens are being documented in a format useful for both design inspection and engineering translation.

### Recommended Shadow Usage

- `shadow-none`: flat UI, borders-only containers, low-emphasis surfaces
- `shadow-sm`: subtle separation from the background
- `shadow-md`: default elevated cards or panels
- `shadow-lg`: dialogs, key overlays, or important surfaced content
- `shadow-xl`: high-priority overlays or strong elevation moments

## How This Page Should Be Used

This tokens page should guide all visual implementation decisions before component styling is finalized.

Recommended workflow:

1. start with the token page, not arbitrary values
2. choose a primitive or semantic token that matches the needed meaning
3. apply that token consistently through components
4. only introduce new tokens when an existing one clearly does not fit

This prevents:

- duplicate values with different names
- inconsistent dark or light treatment
- mismatched elevation patterns
- color drift across screens

## Relationship Between Tokens And Components

The component library and token library should work together as separate but connected layers.

The component page answers:

- what building blocks exist
- what variants and states exist
- how they are assembled

The tokens page answers:

- what visual values power those building blocks
- what palette and depth decisions are allowed
- which values should be reused instead of recreated

In a mature system:

- components should reference semantic tokens
- semantic tokens should map to primitive tokens
- product screens should use components rather than bypassing both layers

## Governance Notes

### Naming

The token page already shows a helpful naming direction:

- hue family plus scale step for primitive colors
- human-readable token names for effects
- code-facing class labels for shadow utilities

This is a strong start, but the system would benefit from a documented naming convention that explicitly distinguishes:

- primitive tokens
- semantic tokens
- utility or implementation aliases

### Documentation Gaps

The current board is visually rich, but several things still need stronger written definition:

- semantic color tokens
- spacing tokens
- typography tokens
- radius tokens
- motion tokens, if they exist
- token usage rules by context

This file should evolve as those areas are documented more explicitly in Figma or code.

## Recommended Future Template For Each Token Family

Each token family should eventually be documented using a repeatable structure:

### Token Family Name

- Purpose
- Naming convention
- Scale or available values
- Intended use
- Do not use for
- Code mapping
- Accessibility or contrast notes

This would make the token documentation much easier to maintain and much easier to hand off to engineering.

## Implementation Guidance For Engineering

When translating this token system into code, the safest approach is:

1. store primitive values as CSS custom properties or theme constants
2. create semantic aliases on top of those primitives
3. have components consume semantic tokens wherever possible

Example structure:

- primitives: `--color-blue-200`, `--color-grey-400`
- semantic: `--color-text-primary`, `--color-surface-muted`, `--color-border-default`
- effects: `--shadow-sm`, `--shadow-lg`

This gives the design system flexibility without forcing product code to depend on raw palette values everywhere.

## Summary

The `Design tokens` page is the visual foundation of the Creditra design system. Based on the linked Figma section, it clearly documents:

- primitive color families
- stepped tonal scales
- standardized shadow tokens
- code-aware naming for at least part of the effect system

The strongest confirmed areas today are:

- neutral palette structure
- blue accent scale
- shadow/elevation tokens

As the system matures, this page should continue to serve as the source of truth for every reusable visual value that powers the component library and the product UI.
