# Add Terms of Service and Privacy Policy Pages

## Summary

This PR adds missing `/terms` and `/privacy` routes with dedicated pages, fulfilling links in the RegisterPage and TermsBanner. The implementation includes:

- **New pages**: `Terms.tsx` and `Privacy.tsx` with placeholder but comprehensive content
- **Shared constant**: `TERMS_VERSION` exported from `src/constants/legal.ts` for version tracking
- **Updated TermsBanner**: Simplified to link directly to `/terms` instead of opening a modal
- **Routes**: Added to App.tsx with lazy loading for code splitting
- **Tests**: Comprehensive test suite for both pages and updated TermsBanner tests

## Changes

### New Files
- `src/constants/legal.ts` — Exports `TERMS_VERSION = "2026-07"`
- `src/pages/Terms.tsx` — Terms of Service page with 7 sections, effective date, and version display
- `src/pages/Privacy.tsx` — Privacy Policy page with 9 sections and contact information
- `src/pages/__tests__/LegalPages.test.tsx` — Test suite covering both legal pages

### Modified Files
- `src/components/TermsBanner.tsx`:
  - Imports `TERMS_VERSION` from shared constant
  - Changed "Review Terms" button to a `Link` pointing to `/terms`
  - Removed modal implementation (simplified UX)
  - Reduced component state from 2 to 1 boolean

- `src/components/TermsBanner.test.tsx`:
  - Updated tests to work with the new link-based flow
  - Wrapped component in `BrowserRouter` for Link compatibility
  - Tests verify link navigates to `/terms`

- `src/App.tsx`:
  - Added lazy imports for `Terms` and `Privacy` components
  - Added routes before the catch-all `*` route

## Acceptance Criteria Met

✅ `/terms` and `/privacy` routes render their pages (not 404)  
✅ Terms page displays the same `TERMS_VERSION` as TermsBanner  
✅ Routes are accessible while logged out (no guards applied)  
✅ TermsBanner links to `/terms` page  
✅ Document titles set correctly via `useEffect`  
✅ Placeholder disclaimer included with note to replace before production  
✅ Tests pass for both pages and updated TermsBanner  

## Testing

Run the test suite with:
```bash
npm test -- --run src/pages/__tests__/LegalPages.test.tsx src/components/TermsBanner.test.tsx
```

The build can be tested with:
```bash
npm run build
```

## Styling

Both pages use CSS-in-JS with inline styles that:
- Respect dark theme via CSS custom properties
- Include responsive design for mobile (640px breakpoint)
- Match the existing project color palette
- Include proper contrast for accessibility

## Important Notes

⚠️ **Placeholder Legal Copy**: The terms and privacy content are placeholder text intended for review. Before production deployment, all legal copy must be reviewed and approved by counsel. The placeholder includes a clear disclaimer on each page.

## Deployment

No build output, binaries, .vscode/, or workflow changes are included. The implementation:
- Follows existing code patterns and conventions
- Uses lazy loading for code splitting (non-critical for first paint)
- Integrates seamlessly with current routing and styling
- Ready for the CI workflow (npm run build)
