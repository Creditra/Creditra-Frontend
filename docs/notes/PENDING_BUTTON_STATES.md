# Pending Button States

Standardized rules for submit/async action buttons across all forms.

## Component

`src/components/PendingButton.tsx` — use this instead of a raw `<button>` for any form submission or async action.

```tsx
<PendingButton
  type="submit"
  pending={loading}
  pendingLabel="Saving..."
  className="..."
>
  Save
</PendingButton>
```

### Props

| Prop | Type | Description |
|---|---|---|
| `pending` | `boolean` | Whether the async action is in progress |
| `pendingLabel` | `string` | Label shown while pending (e.g. "Signing in...") |
| `children` | `ReactNode` | Idle label |
| `disabled` | `boolean` | Additional disabled condition (e.g. form invalid) |
| `...rest` | `ButtonHTMLAttributes` | All standard button attributes |

## Rules

1. **Spinner placement** — inline, left of label. SVG-based, sized `1em` so it scales with font size.
2. **No layout shift** — `min-width: max-content` on `.pending-btn` keeps the button width stable between idle and pending states.
3. **Disabled while pending** — `disabled` and `aria-busy="true"` are set automatically when `pending={true}`. This prevents double-submission.
4. **Label change** — the visible label changes to `pendingLabel` during submission. Screen readers announce the change via the button's accessible name.
5. **Reduced motion** — the spinner animation is disabled via `@media (prefers-reduced-motion: reduce)`.

## Covered flows

| Flow | File | Pending label |
|---|---|---|
| Login | `LoginPage.tsx` | "Signing in..." |
| Register | `RegisterPage.tsx` | "Creating Account..." |
| Forgot password | `ForgotPasswordPage.tsx` | "Sending..." |
| Reset password | `ResetPasswordPage.tsx` | "Resetting..." |
| Draw credit confirm | `ConfirmationStep.tsx` | "Processing..." |
| Repay confirm | `RepayModal.tsx` | "Processing..." |
| Request evaluation | `RequestEvaluation.tsx` | "Starting..." |
