## Summary

<!-- What changed and why -->

## Screenshots / GIFs

<!-- Before + after for any UI change -->

## Test plan

- [ ] <!-- How you verified the change -->

## Linked issue

Closes #

---

### Review checklist

- [ ] PR is one logical change, not a stack
- [ ] Conventional-commit title
- [ ] Tests added or updated for new behaviour
- [ ] Screenshots for UI change
- [ ] No new TypeScript errors (`npm run build` passes)
- [ ] Lint clean (`npm run lint`)
- [ ] Existing test count is neutral or higher

### Accessibility check (UI changes only)

- [ ] Keyboard navigation works (Tab, Shift+Tab, Enter, Escape)
- [ ] Focus indicators are visible
- [ ] Contrast ratios meet WCAG AA (4.5:1 text, 3:1 large/icons)
- [ ] Touch targets are at least 44x44 px
- [ ] Semantic HTML; ARIA only where no native element fits
- [ ] prefers-reduced-motion is respected

### Design-token check (UI changes only)

- [ ] No new inline hex values; tokens used from src/index.css or src/utils/tokens.ts
- [ ] No new inline spacing values; CSS custom properties used (--space-*)
- [ ] New tokens, if any, are added to both src/utils/tokens.ts and Design System/tokens.md

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for full contribution guidelines.
