# Component Page Documentation

## Figma Source

- Component library section: [CREDITRA DESIGN SYSTEM - Component Library](https://www.figma.com/design/sdRDpwLg8dzX4UMT7U9u6O/CREDITRA-DESIGN-SYSTEM?node-id=4004-4456&t=A3GYaMwKM39Doxms-11)
- Figma file key: `sdRDpwLg8dzX4UMT7U9u6O`
- Section node: `4004:4456`
- Section name in Figma: `Compnent Library`

## Purpose

This page is the component reference area of the Creditra design system. It gathers the reusable UI building blocks used across product flows, especially form-heavy and interaction-heavy experiences. The page is meant to help designers and developers:

- see the currently defined component inventory in one place
- understand which variants already exist before creating new patterns
- reuse the same structures across product screens
- maintain consistent interaction styling for forms, actions, overlays, and selection controls

This page reads like a working library board rather than a marketing-style showcase. Most sections are organized as small demo frames with a header and one or more variants beneath them.

## Page Structure

The `Component Library` section is arranged as a horizontal set of grouped component categories. Each category appears inside its own frame with a simple title header and a sample area below it.

Based on the linked section, the page currently contains these major groups:

1. Form
2. Input
3. Card
4. Dialogue
5. Popover
6. Radio
7. Heading
8. Buttons
9. Slot

The page is broad but not deeply annotated inside Figma, so this documentation acts as the written explanation layer for what the component board is showing.

## Documentation Goals For This Page

This page should serve as the source of truth for:

- available components
- available variants and states
- composition patterns between smaller and larger components
- naming expectations for reuse
- when to reuse an existing component versus introduce a new one

It is not yet a full engineering spec page with exhaustive tokens, spacing rules, accessibility guidance, or code mapping. Those can be documented separately in companion files.

## Component Inventory

### 1. Form

The `Form` area is the largest section on the page and appears to function as a composition zone where smaller components are assembled into realistic application patterns.

Visible examples include:

- `variant 1=form, variant 2=full`
- `variant 1=Form, variant 2=Create Project`
- `Form/Bio`
- `Form/Edit Profile`
- `Form/Dimensions`

What this tells us:

- the system supports both generic form shells and more concrete use-case forms
- inputs, headings, paragraph text, and buttons are intended to work together as a composable set
- the library is not limited to atomic components; it also includes assembled patterns

Expected purpose of this section:

- demonstrate how inputs are stacked
- show how labels and descriptions are paired with fields
- define how action buttons sit inside forms
- show default content density for simple and multi-field layouts

Recommended documentation rule:

- treat `Form` as a pattern-level component group, not a single primitive

### 2. Input

The `Input` group contains several related field patterns rather than just one basic text field.

Visible items include:

- `input-field/variant4`
- `variant=Default`
- `variant=hover`
- `input-field/number-input`
- `Input/With Label`
- another `Input/With Label` example with a taller height, likely representing helper text, error text, or multiline support

What this section communicates:

- the design system distinguishes between base field states and wrapped field patterns
- labels are treated as part of a reusable field composition
- numeric entry is important enough to have its own specific variant
- field states are part of the component definition, not an afterthought

Recommended usage guidance:

- use the base input component when you only need the field shell
- use `Input/With Label` for product screens where context is required
- use the number input variant for amount entry, dimensions, pricing, or other structured numeric values
- keep hover and other interaction states visually aligned with the library instead of styling per screen

### 3. Buttons

The `Buttons` group contains the clearest set of explicit variants on the page.

Visible variants:

- `primary`
- `secondary`
- `disabled`
- `warning`
- `distructive`
- `success`
- `link`

Notes:

- the Figma label uses `distructive`, which likely intends `destructive`
- this should be normalized in future design and implementation naming

Purpose of the button set:

- provide a complete action hierarchy
- support neutral, high-emphasis, success, warning, destructive, and text-link actions
- keep action semantics consistent across dialogs, forms, cards, and popovers

Recommended semantic usage:

- `primary`: main call to action in a section or flow
- `secondary`: supporting action with lower emphasis
- `disabled`: non-interactive state of another variant
- `warning`: actions with caution or risk implications
- `destructive`: permanent or harmful actions such as delete, remove, or revoke
- `success`: confirmation or positive follow-up actions
- `link`: lightweight inline or tertiary navigation action

### 4. Heading

The `Heading` group appears to define text blocks for section titles rather than raw typography tokens.

Visible variants:

- `variant=solo`
- `variant=with-description`
- `heading-wrap`

What this implies:

- the system supports headings both with and without supporting descriptive text
- content blocks may be wrapped in a reusable heading container
- headings are treated as UI components, not only text styles

Recommended use:

- `solo`: short titles with no supporting body copy
- `with-description`: title plus helper or explainer text
- `heading-wrap`: section headers or grouped content headers needing consistent spacing and alignment

### 5. Card

The `Card` area currently shows a single `card` example.

This likely establishes:

- container styling
- internal padding standards
- border or elevation treatment
- how content modules should be framed against a page background

Cards should be used when content needs:

- visual grouping
- separation from surrounding page content
- a reusable container for summaries, forms, stats, or selection panels

### 6. Dialogue

The `Dialogue` section contains one visible `dialogue` component example.

This is likely the library’s modal or dialog container pattern. It should define:

- overlay content structure
- dialog body spacing
- title and description arrangement
- action row placement

Recommended use:

- confirmations
- interruption flows
- form-in-modal interactions
- destructive-action review states

### 7. Popover

The `Popover` section shows a single `popover` component sample.

This likely represents a lightweight contextual overlay distinct from the more formal dialog pattern.

Recommended use:

- lightweight contextual actions
- brief supporting information
- inline selections or quick helpers

Avoid using popovers for:

- long forms
- mission-critical confirmations
- flows that require strong focus trapping

### 8. Radio

The `Radio` section includes several related patterns:

- `Radio Group`
- `Radio` with `State=Off` and `State=On`
- `Radio Card` with `Active=Off` and `Active=On`

This is a strong signal that the design system supports both:

- simple radio selections
- richer card-based choice patterns

Recommended use:

- standard radio: compact mutually exclusive options
- radio group: grouped control with shared spacing and labeling behavior
- radio card: more descriptive or visual option selection where each choice needs more content

### 9. Slot

The `Slot` section contains `slot -component`.

This likely acts as a placeholder or compositional wrapper rather than a user-facing visual component. In many systems, a slot component provides structure for:

- icon placement
- injected child content
- leading and trailing content regions
- flexible composition without redefining layout rules

This section should be documented further once the intended implementation behavior is confirmed.

## How The Page Is Organized

The page follows a repeated documentation pattern:

- a named header frame
- one or more instances or symbols below the header
- variants grouped close together for quick comparison

This creates a practical scan path:

1. identify the component family
2. compare states or variants
3. reference the assembled pattern if one exists

This is useful for both design reviews and UI implementation handoff because it reduces ambiguity around which variant should be used.

## Design-System Maturity Observations

From the linked section, the library appears to be at an early-to-mid maturity stage:

- core interaction components exist
- several form-related patterns are already assembled
- variant naming is present, but not always normalized
- some sections are clearly documented by structure, but not yet by written guidance

That means this component page already works well as a visual inventory, but it benefits significantly from written documentation like this file.

## Naming And Governance Notes

A few naming issues are visible directly in the Figma section:

- `Compnent Library` should likely be renamed to `Component Library`
- `distructive` should likely be renamed to `destructive`
- one frame labeled `Input` appears to actually represent `Slot`
- one `Radio` area contains header text that appears to say `Heading`
- another `Radio` area includes header text that appears to say `Dialogue`

These inconsistencies do not break the library visually, but they make handoff and implementation harder. Recommended cleanup:

1. normalize section names
2. normalize variant spelling
3. align frame names with actual component purpose
4. keep design names identical to engineering names where possible

## Recommended Documentation Standard For Each Component Section

Each component on this page should eventually be documented using the same template:

### Component Name

- Purpose
- When to use
- When not to use
- Variants
- States
- Anatomy
- Content rules
- Interaction behavior
- Accessibility considerations
- Related components

Applying that structure consistently will make this page much easier to use for both design and engineering teams.

## Suggested Next Documentation Pass

The next useful step for this design system would be to expand each component family into its own subsection or separate file with:

- variant-by-variant descriptions
- state definitions such as default, hover, active, disabled, selected
- spacing and sizing rules
- content rules for labels, helper text, descriptions, and actions
- accessibility requirements
- engineering mapping to code components

## Summary

The linked Figma section functions as the reusable component foundation of the Creditra UI system. It currently covers:

- buttons
- inputs
- forms
- cards
- dialogs
- popovers
- headings
- radio controls
- slots

Its strongest emphasis today is on structured data entry and action-driven UI. This makes sense for a product experience centered around workflows, forms, selections, and modal interactions.

As the design system evolves, this page should remain the canonical visual inventory for reusable components, while companion documentation expands the behavioral and implementation details for each component family.
