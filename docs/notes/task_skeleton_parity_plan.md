# Skeleton shape parity — implementation plan (for approval)

## Information gathered
- `src/components/Skeleton.tsx` renders a single `<div>` with class `skeleton` and supports `width`/`height` via inline styles.
- `src/components/Skeleton.css` currently defines background, overflow clipping, shimmer gradient animation, and reduced-motion handling.
- Existing `src/components/Skeleton.test.tsx` only verifies width/height/className/attribute spreading.
- Repo uses design tokens from `src/index.css` (e.g., `--border`, `--surface`) and already includes high-contrast overrides.
- Skeleton component currently has **no border-radius**, meaning skeleton shape can differ from final card shapes.

## Plan
1. Update `src/components/Skeleton.css` to add a border-radius and any needed background/elevation consistency so skeletons visually match the “final card shape” across breakpoints and in dark mode.
   - Use existing radius tokens (e.g., `var(--radius-md)` or `var(--radius-lg)`) for consistency.
   - Ensure shimmer respects rounded corners (already clipped via `overflow: hidden`).
   - Keep reduced-motion behavior intact.
2. Update `src/components/Skeleton.test.tsx` with new assertions for the shape-parity behavior.
   - Add tests that verify the skeleton element has the expected `border-radius` via computed style (or via class rule injection strategy used by the test env).
   - Add tests ensuring reduced-motion override still disables shimmer animation.
3. Run `npm test -- --run` and `npm run lint`.
4. Document visible/API changes (expected: none; only styling + tests).

## Dependent files to edit
- `src/components/Skeleton.css`
- `src/components/Skeleton.test.tsx`

## Followup steps
- If tests fail due to jsdom style limitations, adjust tests to validate via className + rule presence (and keep them focused).

<ask_followup_question>
Proceed with this styling/test-only approach (no repo-wide skeleton call-site audit). Target radius token to use: `--radius-md`.
</ask_followup_question>


