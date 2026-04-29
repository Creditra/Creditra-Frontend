# Form Field Pattern - Quick Reference

## Basic Usage

```typescript
import { FormField } from '@/components/FormField';

<FormField
  id="email"
  label="Email Address"
  type="email"
  required
  helpText="We'll never share your email"
  error={errors.email}
  inputProps={{
    value: formData.email,
    onChange: handleChange,
    placeholder: "you@example.com",
    autoComplete: "email"
  }}
/>
```

## Common Patterns

### Text Input
```typescript
<FormField
  id="username"
  label="Username"
  type="text"
  required
  helpText="Choose a unique username"
  error={errors.username}
  inputProps={{
    value: username,
    onChange: (e) => setUsername(e.target.value),
    placeholder: "johndoe"
  }}
/>
```

### Email Input
```typescript
<FormField
  id="email"
  label="Email Address"
  type="email"
  required
  helpText="We'll never share your email"
  error={errors.email}
  inputProps={{
    value: email,
    onChange: (e) => setEmail(e.target.value),
    placeholder: "you@example.com",
    autoComplete: "email"
  }}
/>
```

### Password Input
```typescript
<FormField
  id="password"
  label="Password"
  type="password"
  required
  helpText="Must be at least 8 characters"
  error={errors.password}
  inputProps={{
    value: password,
    onChange: (e) => setPassword(e.target.value),
    placeholder: "Enter your password",
    autoComplete: "current-password"
  }}
/>
```

### Number Input
```typescript
<FormField
  id="amount"
  label="Amount"
  type="number"
  required
  helpText="Enter amount in USD"
  error={errors.amount}
  inputProps={{
    value: amount,
    onChange: (e) => setAmount(e.target.value),
    placeholder: "0.00",
    min: "0",
    step: "0.01"
  }}
/>
```

### Textarea
```typescript
<FormField
  id="description"
  label="Description"
  as="textarea"
  required
  helpText="Provide a detailed description"
  error={errors.description}
  inputProps={{
    value: description,
    onChange: (e) => setDescription(e.target.value),
    placeholder: "Enter description...",
    rows: 4
  }}
/>
```

### File Upload (Custom)
```typescript
<FormField
  id="document"
  label="Upload Document"
  helpText="PDF or CSV files only"
  error={errors.document}
  as="custom"
>
  {(props) => (
    <input
      {...props}
      type="file"
      accept=".pdf,.csv"
      onChange={handleFileChange}
    />
  )}
</FormField>
```

### Checkbox
```typescript
<div className="form-field form-field--checkbox">
  <input
    id="accept-terms"
    type="checkbox"
    checked={accepted}
    onChange={(e) => setAccepted(e.target.checked)}
    className="form-field__input"
    aria-describedby="accept-terms-help"
    aria-required="true"
  />
  <label htmlFor="accept-terms" className="form-field__label">
    I accept the Terms and Conditions
    <span className="form-field__required" aria-label="required">*</span>
  </label>
  <p id="accept-terms-help" className="form-field__help">
    You must accept to continue
  </p>
</div>
```

### Radio Group
```typescript
<fieldset>
  <legend className="form-field__label">
    Payment Method
    <span className="form-field__required" aria-label="required">*</span>
  </legend>
  <p className="form-field__help">Select your preferred payment method</p>
  
  <div className="form-field form-field--radio">
    <input
      id="credit-card"
      type="radio"
      name="payment"
      value="credit-card"
      checked={payment === 'credit-card'}
      onChange={(e) => setPayment(e.target.value)}
      className="form-field__input"
    />
    <label htmlFor="credit-card" className="form-field__label">
      Credit Card
    </label>
  </div>
  
  <div className="form-field form-field--radio">
    <input
      id="bank-transfer"
      type="radio"
      name="payment"
      value="bank-transfer"
      checked={payment === 'bank-transfer'}
      onChange={(e) => setPayment(e.target.value)}
      className="form-field__input"
    />
    <label htmlFor="bank-transfer" className="form-field__label">
      Bank Transfer
    </label>
  </div>
</fieldset>
```

## Props Reference

### FormField Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier for the field |
| `label` | `string` | ✅ | Visible label text |
| `type` | `'text' \| 'email' \| 'password' \| 'number' \| 'tel' \| 'url'` | ❌ | Input type (default: 'text') |
| `as` | `'input' \| 'textarea' \| 'custom'` | ❌ | Element type (default: 'input') |
| `required` | `boolean` | ❌ | Shows asterisk and sets aria-required |
| `helpText` | `string` | ❌ | Instructional text below label |
| `error` | `string` | ❌ | Error message to display |
| `className` | `string` | ❌ | Additional CSS classes |
| `inputProps` | `object` | ❌ | Props passed to input/textarea |

## Error Handling

### Field-Specific Errors
```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

// Set error for specific field
setErrors({ ...errors, email: 'Please enter a valid email' });

// Use in FormField
<FormField
  id="email"
  error={errors.email}
  // ...
/>
```

### Clear Errors on Change
```typescript
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  const { name, value } = e.target;
  setFormData({ ...formData, [name]: value });
  
  // Clear error when user starts typing
  if (errors[name]) {
    setErrors({ ...errors, [name]: '' });
  }
}
```

### Validation on Blur
```typescript
function handleBlur(field: string) {
  const value = formData[field];
  
  if (field === 'email' && !isValidEmail(value)) {
    setErrors({ ...errors, email: 'Please enter a valid email' });
  }
}

<FormField
  id="email"
  inputProps={{
    value: formData.email,
    onChange: handleChange,
    onBlur: () => handleBlur('email')
  }}
/>
```

## Accessibility Checklist

- ✅ Label is associated with input via `htmlFor`/`id`
- ✅ Required fields show asterisk with `aria-label="required"`
- ✅ Help text is linked via `aria-describedby`
- ✅ Error messages use `aria-invalid` and `aria-live="polite"`
- ✅ Focus rings are visible (2px solid accent)
- ✅ Keyboard navigation works (Tab/Shift+Tab)
- ✅ Color contrast meets WCAG AA (4.5:1)

## Common Mistakes to Avoid

### ❌ Don't: Missing label association
```typescript
<label>Email</label>
<input id="email" />
```

### ✅ Do: Proper label association
```typescript
<label htmlFor="email">Email</label>
<input id="email" />
```

### ❌ Don't: Missing required indicator
```typescript
<label htmlFor="email">Email</label>
<input id="email" required />
```

### ✅ Do: Visible required indicator
```typescript
<label htmlFor="email">
  Email
  <span className="form-field__required" aria-label="required">*</span>
</label>
<input id="email" aria-required="true" />
```

### ❌ Don't: Error without aria-invalid
```typescript
{error && <div>{error}</div>}
<input id="email" />
```

### ✅ Do: Error with proper ARIA
```typescript
{error && (
  <div id="email-error" role="alert" aria-live="polite">
    {error}
  </div>
)}
<input id="email" aria-invalid={!!error} aria-describedby="email-error" />
```

## Styling Reference

### CSS Classes

- `.form-field` - Container for the entire field
- `.form-field__label` - Label element
- `.form-field__required` - Required asterisk
- `.form-field__help` - Help text
- `.form-field__input` - Input element
- `.form-field__textarea` - Textarea element
- `.form-field__input--error` - Error state for input
- `.form-field__error` - Error message container
- `.form-field__error-icon` - Error icon
- `.form-field--checkbox` - Checkbox variant
- `.form-field--radio` - Radio variant

### CSS Variables

- `--text` - Primary text color
- `--muted` - Secondary text color
- `--error` - Error color
- `--surface` - Input background
- `--border` - Input border
- `--accent` - Focus/hover color
- `--space-xs` - 0.25rem
- `--space-sm` - 0.5rem
- `--space-md` - 0.75rem
- `--space-lg` - 1rem
- `--space-xl` - 1.5rem

## Testing

### Manual Testing
1. Tab through all fields - focus should be visible
2. Use screen reader - all elements should be announced
3. Submit with errors - errors should appear and be announced
4. Fix errors - errors should clear
5. Test with keyboard only - should be fully functional

### Automated Testing
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('shows error message', async () => {
  const { rerender } = render(
    <FormField
      id="email"
      label="Email"
      error=""
      inputProps={{ value: '', onChange: () => {} }}
    />
  );
  
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  
  rerender(
    <FormField
      id="email"
      label="Email"
      error="Invalid email"
      inputProps={{ value: '', onChange: () => {} }}
    />
  );
  
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
});
```

## Support

For questions or issues:
1. Check [COMPONENT_SPECS.md](./COMPONENT_SPECS.md) for detailed documentation
2. Review [FORM_FIELD_STANDARDIZATION_SUMMARY.md](./FORM_FIELD_STANDARDIZATION_SUMMARY.md) for implementation details
3. Refer to existing implementations in auth pages
