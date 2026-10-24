# RiskGauge Tabular Nums (v7)

## Summary
Added tabular numerals to the RiskGauge score display to prevent digit-width wobble during score animations, improving visual stability.

## Changes Made

### 1. `src/components/RiskGauge.css`
Updated `.risk-gauge-score` class to include:
- `font-variant-numeric: tabular-nums` - CSS property for tabular numerals
- `font-feature-settings: "tnum" 1` - Fallback for broader browser support
- Added inline comment explaining the purpose

This ensures that when the score animates (e.g., from 72 to 80), the digits maintain consistent width, preventing horizontal jitter.

### 2. `src/components/RiskGauge.test.tsx`
Added CSS assertion test: ".risk-gauge-score has tabular-nums to prevent digit-width wobble during animation"
- Verifies that the `.risk-gauge-score` class includes the `font-variant-numeric: tabular-nums` property
- Follows the existing pattern of CSS source assertions in the file

## Visual Changes
- **Before**: Score digits could shift horizontally as the value changed during animation
- **After**: Score digits maintain consistent width, providing a stable visual experience during score transitions

## Accessibility Impact
- Improves readability for all users by reducing visual noise during animations
- Particularly beneficial for users with visual processing difficulties or motion sensitivity
- No impact on screen readers (purely visual enhancement)
- No changes to keyboard navigation or focus states

## Technical Details
- Uses standard CSS `font-variant-numeric: tabular-nums` property
- Includes `font-feature-settings: "tnum" 1` as a fallback for older browsers
- Property is purely typographic and does not affect color or layout
- No additional media queries needed (works across all viewing modes)
- Consistent with existing tabular-nums patterns in `src/styles/typography.css`

## Testing
- Added CSS assertion test to verify the property is present in the stylesheet
- Test follows existing pattern of CSS source assertions in RiskGauge.test.tsx
- No functional changes to component behavior

## Browser Compatibility
- `font-variant-numeric: tabular-nums` is widely supported in modern browsers
- `font-feature-settings: "tnum" 1` provides fallback support
- Gracefully degrades in browsers that don't support tabular numerals (falls back to proportional numerals)

## Notes
- No API changes - this is a visual enhancement only
- The implementation follows the established pattern in `src/styles/typography.css`
- Design tokens and dark-mode consistency are maintained (property is color-agnostic)
- Reduced-motion users benefit from this change as well, even though animations are suppressed
