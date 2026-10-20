# Task: focus-visible outline on RepayPage (issue #512 / buffer #16)

## Steps

### Step 1: Update `src/styles/focus.css`
- [ ] Add scoped `.repay-page` focus-visible selectors covering ALL interactive elements
- [ ] Follow the established `.dc-page` pattern from DrawCreditPage

### Step 2: Update `src/pages/RepayPage.tsx`
- [x] Auto-schedule toggle: replace `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent` → `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
- [x] "I need help" button: replace `focus-visible:outline-blue-400` → `focus-visible:outline-accent`
- [x] Add `rp-back-btn` class to back buttons
- [x] Add `rp-cl-card` class to credit line selection cards
- [x] Add `rp-preset-btn` and `rp-smart-pay-btn` to preset/Smart Pay buttons
- [x] Add `rp-amount-input` to the amount input field
- [x] Add `rp-toggle-switch` to auto-schedule toggle
- [x] Add `rp-review-btn` and `rp-preview-btn` to action buttons
- [x] Add `rp-help-btn` and `rp-cancel-btn` to help/cancel buttons
- [x] Add `rp-back-input-btn` and `rp-confirm-btn` to review step buttons
- [x] Add `rp-dashboard-btn` and `rp-new-repay-btn` to success step buttons

### Step 3: Update test files
- [x] Update `src/pages/__tests__/RepayPage.test.tsx` focus-visible tests with new CSS class assertions
- [x] Add tests for auto-schedule toggle focus-visible outline consistency
- [x] Add tests for all interactive element `rp-*` CSS classes
- [x] Add RepayPage scoped selector tests in `src/styles/focus.test.tsx`

### Step 4: Run tests
- [ ] `npm test` or `npx vitest run` to verify all tests pass
- [ ] Ensure no regressions

