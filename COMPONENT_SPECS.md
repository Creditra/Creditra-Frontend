# Component Specifications for Design

## Design System

### Color Palette
```css
--bg: #0d1117           /* Main background */
--surface: #161b22      /* Card/modal background */
--border: #30363d       /* Borders and dividers */
--text: #e6edf3         /* Primary text */
--muted: #8b949e        /* Secondary text */
--accent: #58a6ff       /* Primary actions (blue) */
--success: #3fb950      /* Success states (green) */
--warning: #d29922      /* Warning states (orange) */
--error: #f85149        /* Error states (red) */
```

### Typography
```css
Font Family: system-ui, -apple-system, sans-serif
Line Height: 1.5

Sizes:
- H2 (Modal Title): 1.25rem (20px)
- H3 (Wallet Name): 1rem (16px)
- Body: 0.9rem (14.4px)
- Small: 0.85rem (13.6px)
- Tiny: 0.75rem (12px)
```

### Spacing Scale
```css
0.25rem = 4px
0.5rem = 8px
0.75rem = 12px
1rem = 16px
1.5rem = 24px
2rem = 32px
2.5rem = 40px
3rem = 48px
```

### Border Radius
```css
Small: 4px
Medium: 6px
Large: 8px
XLarge: 12px
Round: 50%
```

---

## Card Component

### Base Card (.card)
- **Background**: var(--surface)
- **Border**: 1px solid var(--border)
- **Border Radius**: 8px
- **Padding**: 1.5rem (24px) desktop, 1rem (16px) mobile
- **Margin Bottom**: 1rem
- **Transition**: border-color 0.2s, transform 0.2s
- **Animation**: fadeInUp 0.4s ease both

#### Hover State
- **Border Color**: var(--accent)
- **Transform**: translateY(-1px)

#### Header (h2)
- **Margin**: 0 0 0.75rem
- **Font Size**: 1.125rem (18px)
- **Font Weight**: 600
- **Color**: var(--text)
- **Display**: Flex, align-items center, gap 0.5rem

#### Header Icon (.icon)
- **Font Size**: 1.1rem

#### Body Text (p)
- **Margin**: 0
- **Color**: var(--muted)
- **Font Size**: 0.9rem (14.4px)

### Large Card (.card-large)
- **Padding**: 2rem (32px) desktop, 1.5rem (24px) mobile
- All other properties same as base .card

---

## Component 1: Wallet Connection Modal

### Dimensions
- Width: 90% (mobile), max 480px (desktop)
- Max Height: 90vh
- Border Radius: 12px
- Border: 1px solid var(--border)

### Modal Overlay
- Background: rgba(0, 0, 0, 0.7)
- Backdrop Filter: blur(4px)
- Z-index: 1000

### Header Section
- Padding: 1.5rem (24px)
- Border Bottom: 1px solid var(--border)
- Display: Flex, space-between

#### Title
- Font Size: 1.25rem
- Font Weight: 600
- Color: var(--text)
- Margin: 0

#### Close Button
- Size: 32x32px
- Font Size: 1.5rem
- Color: var(--muted)
- Hover: Background var(--border), Color var(--text)
- Border Radius: 4px

### Description Section
- Padding: 1.5rem
- Font Size: 0.9rem
- Color: var(--muted)
- Line Height: 1.6

### Wallet List
- Padding: 0 1.5rem 1.5rem
- Gap: 0.75rem (12px)

#### Wallet Card
- Padding: 1rem (16px)
- Background: var(--bg)
- Border: 1px solid var(--border)
- Border Radius: 8px
- Display: Flex, align-items center
- Gap: 1rem

**Hover State:**
- Border Color: var(--accent)
- Transform: translateY(-2px)
- Box Shadow: 0 4px 12px rgba(88, 166, 255, 0.1)

**Loading State:**
- Border Color: var(--accent)
- Opacity: 0.6

#### Wallet Icon
- Size: 48x48px
- Font Size: 2rem
- Background: var(--surface)
- Border Radius: 8px
- Display: Flex, center

#### Wallet Info
- Flex: 1

**Name:**
- Font Size: 1rem
- Color: var(--text)
- Margin Bottom: 0.25rem

**Description:**
- Font Size: 0.85rem
- Color: var(--muted)

#### Loading Spinner
- Size: 20x20px
- Border: 2px solid var(--border)
- Border Top: 2px solid var(--accent)
- Border Radius: 50%
- Animation: Spin 0.8s linear infinite

### Error State
- Margin: 0 1.5rem 1.5rem
- Padding: 1rem
- Background: rgba(248, 81, 73, 0.1)
- Border: 1px solid rgba(248, 81, 73, 0.3)
- Border Radius: 8px
- Display: Flex, gap 0.75rem

**Icon:**
- Font Size: 1.25rem
- Color: var(--error)

**Title:**
- Font Weight: 600
- Color: var(--error)
- Margin Bottom: 0.25rem

**Message:**
- Font Size: 0.85rem
- Color: var(--muted)

### Success State
- Padding: 3rem 1.5rem
- Text Align: Center

**Icon:**
- Size: 64x64px
- Background: var(--success)
- Border Radius: 50%
- Font Size: 2rem
- Color: white
- Margin: 0 auto 1rem
- Animation: ScaleIn 0.4s ease

**Title:**
- Font Size: 1.25rem
- Color: var(--text)
- Margin Bottom: 0.5rem

**Message:**
- Font Size: 0.9rem
- Color: var(--muted)

### Security Note
- Padding: 1rem 1.5rem 1.5rem
- Display: Flex, gap 0.75rem
- Font Size: 0.85rem
- Color: var(--muted)

**Icon:**
- Font Size: 1.25rem

---

## Component 2: Onboarding Flow

### Dimensions
- Width: 90% (mobile), max 500px (desktop)
- Padding: 2.5rem (40px)
- Border Radius: 16px
- Border: 1px solid var(--border)

### Overlay
- Background: rgba(0, 0, 0, 0.85)
- Backdrop Filter: blur(8px)
- Z-index: 1001

### Skip Button
- Position: Absolute, top 1rem, right 1rem
- Padding: 0.5rem 1rem
- Font Size: 0.9rem
- Color: var(--muted)
- Hover: Color var(--text), Background var(--border)
- Border Radius: 4px

### Step Content
- Text Align: Center
- Margin Bottom: 2.5rem

**Icon:**
- Font Size: 4rem
- Margin Bottom: 1.5rem
- Animation: BounceIn 0.6s ease

**Title:**
- Font Size: 1.5rem
- Color: var(--text)
- Margin Bottom: 1rem

**Description:**
- Font Size: 1rem
- Color: var(--muted)
- Line Height: 1.6
- Max Width: 400px
- Margin: 0 auto

### Step Indicators
- Display: Flex, gap 0.5rem
- Justify Content: Center
- Margin Bottom: 2rem

**Indicator:**
- Width: 32px
- Height: 4px
- Background: var(--border)
- Border Radius: 2px
- Transition: All 0.3s

**Active:**
- Background: var(--accent)
- Width: 48px

**Completed:**
- Background: var(--success)

### Primary Button
- Width: 100%, max 200px
- Padding: 0.75rem 2rem
- Background: var(--accent)
- Color: white
- Border Radius: 8px
- Font Size: 1rem
- Font Weight: 500
- Hover: Background #4a8fd8, Transform translateY(-2px)
- Box Shadow: 0 4px 12px rgba(88, 166, 255, 0.3)

---

## Component 3: Wallet Button

### Connect Button (Disconnected State)
- Padding: 0.5rem 1rem
- Background: var(--accent)
- Color: white
- Border Radius: 6px
- Font Size: 0.9rem
- Font Weight: 500
- Hover: Background #4a8fd8, Transform translateY(-1px)
- Box Shadow: 0 2px 8px rgba(88, 166, 255, 0.3)

### Address Button (Connected State)
- Padding: 0.5rem 1rem
- Background: var(--surface)
- Border: 1px solid var(--border)
- Color: var(--text)
- Border Radius: 6px
- Font Size: 0.9rem
- Display: Flex, gap 0.5rem
- Hover: Border Color var(--accent)

**Status Dot:**
- Size: 8x8px
- Background: var(--success)
- Border Radius: 50%
- Animation: Pulse 2s infinite

### Dropdown Menu
- Position: Absolute, top calc(100% + 0.5rem), right 0
- Min Width: 200px
- Padding: 0.75rem
- Background: var(--surface)
- Border: 1px solid var(--border)
- Border Radius: 8px
- Box Shadow: 0 4px 12px rgba(0, 0, 0, 0.3)
- Z-index: 100

**Dropdown Item:**
- Padding: 0.5rem
- Font Size: 0.85rem
- Display: Flex, space-between

**Label:**
- Color: var(--muted)

**Value:**
- Color: var(--text)
- Font Weight: 500
- Text Transform: Capitalize

**Disconnect Button:**
- Width: 100%
- Margin Top: 0.5rem
- Padding: 0.5rem
- Background: none
- Border: 1px solid var(--border)
- Color: var(--text)
- Border Radius: 6px
- Font Size: 0.85rem
- Hover: Background rgba(248, 81, 73, 0.1), Border var(--error), Color var(--error)

---

## Animations

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
Duration: 0.2s
Timing: ease
```

### Slide Up
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
Duration: 0.3s
Timing: ease
```

### Slide Down
```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
Duration: 0.2s
Timing: ease
```

### Scale In
```css
@keyframes scaleIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
Duration: 0.4s
Timing: ease
```

### Bounce In
```css
@keyframes bounceIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
Duration: 0.6s
Timing: ease

---

## Contrast Audit Adjustments (Dark Theme)

### Changes Made for WCAG AA Compliance
- Added `--error: #f85149` to color palette for consistent error styling.
- Updated badge text colors from status-specific colors (e.g., `var(--success)`) to `var(--text)` for improved contrast on colored backgrounds.
- Updated network badge text colors to `var(--text)` for consistency and contrast.
- Updated status badge text colors in `STATUS_COLOR` to `COLOR.text` for all statuses.
- Updated error state text colors in WalletConnectionModal from red/muted to `var(--text)` for higher contrast.
- Updated disconnect button hover colors to use `var(--error)` variable.

### Rationale
- Badge and status text on semi-transparent colored backgrounds had contrast ratios below 4.5:1 for normal text.
- Error text on light red background had insufficient contrast.
- Changes maintain aesthetic by keeping colored backgrounds for visual cues while ensuring text readability.
- All adjustments use token variables to allow future fine-tuning without component overrides.
```

### Spin
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
Duration: 0.8s
Timing: linear
Iteration: infinite
```

### Pulse
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
Duration: 2s
Timing: ease
Iteration: infinite
```

---

## Interactive States

### Buttons
- **Default**: Base styles
- **Hover**: Color change, slight lift (translateY -1px to -2px)
- **Active**: Slight press (translateY 0)
- **Disabled**: Opacity 0.6, cursor not-allowed
- **Loading**: Spinner visible, opacity 0.6

### Cards
- **Default**: Border var(--border)
- **Hover**: Border var(--accent), lift, shadow
- **Active**: Border var(--accent)
- **Disabled**: Opacity 0.6

### Inputs
- **Default**: Border var(--border)
- **Focus**: Border var(--accent), outline none
- **Error**: Border var(--error)
- **Success**: Border var(--success)

---

## Responsive Breakpoints

```css
Mobile: < 768px
  - Modal width: 90%
  - Padding: 1rem
  - Font sizes: -10%

Tablet: 768px - 1024px
  - Modal width: 80%
  - Padding: 1.5rem

Desktop: > 1024px
  - Modal max-width: 480px
  - Padding: 2rem
```

---

## Accessibility

### Focus States
- Outline: 2px solid var(--accent)
- Outline Offset: 2px

### Keyboard Navigation
- Tab: Navigate through interactive elements
- Enter/Space: Activate buttons
- Escape: Close modals

### ARIA Labels
- Modal: role="dialog", aria-modal="true"
- Close button: aria-label="Close"
- Loading: aria-busy="true"
- Error: role="alert"

### Color Contrast
- Text on background: 7:1 (AAA)
- Muted text: 4.5:1 (AA)
- Interactive elements: 3:1 (AA)

---

## Microcopy

### Modal Title
"Connect Wallet"

### Modal Description
"Choose a wallet to connect to Creditra. Your wallet will be used to access credit lines on Stellar."

### Security Note
"🔒 We never store your private keys. Your wallet remains secure."

### Success Message
"Wallet Connected!"
"You're all set to start using Creditra"

### Error Messages
- Not Found: "[Wallet] wallet not found. Please install the extension."
- Failed: "Failed to connect wallet. Please try again."
- Wrong Network: "Please switch to Stellar network in your wallet."

### Onboarding Steps
1. "Welcome to Creditra" / "Your adaptive credit protocol on Stellar blockchain"
2. "Credit Evaluation" / "We analyze your on-chain activity to determine your credit limit and terms"
3. "Flexible Credit Lines" / "Draw and repay credit as needed with dynamic interest rates based on your risk profile"

### Buttons
- Connect: "Connect Wallet"
- Next: "Next"
- Complete: "Get Started"
- Skip: "Skip"
- Disconnect: "Disconnect"

---

## Component 4: Repay Modal

### Dimensions & Layout
- Width: 100%, max 480px
- Border Radius: 12px
- Background: var(--surface)
- Border: 1px solid var(--border)
- Box Shadow: 0 16px 40px rgba(0,0,0,0.4)

### Header
- Padding: 1.5rem
- Border Bottom: 1px solid var(--border)
- Title Size: 1.25rem
- Subtitle: 0.85rem (Credit Line Name / ID)

### Current Debt Display
- Layout: Grid or Flex Row
- "Total Due" Emphasis: Font Size 2rem, Font Weight 700, Color var(--error)
- "Accrued Interest": Font Size 0.85rem, Color var(--muted)

### Input Section
- Label: Font Size 0.9rem, Color var(--text)
- Input Element: Height 48px, Font Size 1.25rem, Padding 0 1rem
- Focus State: Border var(--accent), Box Shadow 0 0 0 2px rgba(88, 166, 255, 0.2)
- Error State: Border var(--error), Text Color var(--error)

### Quick Action Buttons (25%, 50%, 75%, 100%)
- Layout: Grid (4 columns), gap 0.5rem
- Button Style: Base Ghost/Outline style
- Active State: Background rgba(88, 166, 255, 0.1), Border var(--accent), Color var(--accent)

### Preview Section
- Layout: Flex column with dividers
- Remaining Debt: Highlighted in green if 0, else white
- Progress Bar (Utilization): Animate width change from old percentage to new percentage (CSS `transition: width 0.4s ease`).

### Verification Steps & Statuses
- "Review Repayment" Button: Primary style (var(--accent)).
- Pending State Container: Flex centered, large spinner, muted helper text.
- Success State Container: Confetti or Bounce-In checkmark icon (color: var(--success)).

### Microcopy
- Header: "Make a Repayment"
- Input Label: "Amount to Repay"
- Warning: "Amount exceeds outstanding debt" or "Insufficient wallet balance"
- Success: "Repayment Successful! Your credit line balance has been updated."

---

## Component 3: App Header / Top Navigation

### Layout
- Header container padding: `0.75rem 1.5rem`
- Header gap between major regions: `1rem`
- Vertical alignment: all items centered
- Background: `var(--surface)`
- Bottom border: `1px solid var(--border)`

### Brand Link
- Font size: `1.25rem`
- Font weight: `700`
- Min interactive height: `44px`
- Vertical padding: `0.5rem`
- Focus: `2px` accent outline with `2px` offset

### Navigation Links
- Group gap: `0.5rem`
- Link font size: `0.9rem`
- Link font weight: `500`
- Link padding: `0.625rem 0.75rem`
- Min interactive height: `44px`
- Border radius: `6px`
- Default color: `var(--muted)`
- Hover: `var(--text)` + `rgba(88, 166, 255, 0.1)` background
- Active route state: accent text, soft accent background, and subtle accent border
- Focus-visible: `2px solid var(--accent)` outline, offset `2px`

### Wallet Action Area
- Connect/disconnected trigger buttons share the same min height (`44px`) and min width (`168px`) to prevent layout shift
- Shared typography: `0.9rem`, weight `500`
- Shared border radius: `6px`
- Shared interaction states:
  - Hover: color/background change only
  - Active: `translateY(1px)`
  - Focus-visible: `2px` accent outline with `2px` offset


---

## Standardized Form Field Pattern

### Overview
All form fields across the application follow a unified structure to improve accessibility, reduce cognitive load, and ensure consistent error recovery. This pattern is implemented through the `FormField` component.

### Pattern Structure
Every form field must include:
1. **Label**: Programmatically associated with the input via `htmlFor`/`id`
2. **Required Indicator**: Visual asterisk (*) with `aria-label="required"` for screen readers
3. **Help Text**: Instructional text linked via `aria-describedby`
4. **Error Messaging**: High-contrast error messages with `aria-invalid` and `aria-live="polite"`

### Component API

```typescript
<FormField
  id="email"                    // Required: unique identifier
  label="Email Address"         // Required: visible label text
  type="email"                  // Input type (text, email, password, etc.)
  required={true}               // Shows asterisk and sets aria-required
  helpText="We'll never share your email"  // Optional: guidance text
  error={errors.email}          // Optional: error message string
  inputProps={{                 // Pass-through props for the input
    value,
    onChange,
    placeholder: "you@example.com",
    autoComplete: "email"
  }}
/>
```

### Visual Specifications

#### Label
- Font size: `0.9rem` (14.4px)
- Font weight: `500`
- Color: `var(--text)`
- Line height: `var(--lh-small)` (1.5)
- Margin bottom: `var(--space-sm)` (0.5rem)

#### Required Indicator
- Color: `var(--error)`
- Margin left: `var(--space-xs)` (0.25rem)
- Font weight: `600`
- Announced as "required" to screen readers

#### Help Text
- Font size: `0.85rem` (13.6px)
- Color: `var(--muted)`
- Line height: `var(--lh-small)` (1.5)
- Margin: `0`

#### Input Field
- Width: `100%`
- Padding: `0.625rem 0.75rem`
- Font size: `0.9rem`
- Line height: `var(--lh-body)` (1.6)
- Color: `var(--text)`
- Background: `var(--surface)`
- Border: `1px solid var(--border)`
- Border radius: `6px`
- Transition: `border-color 0.2s ease, box-shadow 0.2s ease`

**Hover State:**
- Border color: `var(--accent)`

**Focus State:**
- Outline: `none`
- Border color: `var(--accent)`
- Box shadow: `0 0 0 3px rgba(88, 166, 255, 0.1)`

**Error State:**
- Border color: `var(--error)`
- Box shadow on focus: `0 0 0 3px rgba(248, 81, 73, 0.1)`

#### Error Message
- Display: `flex`
- Align items: `flex-start`
- Gap: `var(--space-sm)` (0.5rem)
- Padding: `var(--space-md)` (0.75rem)
- Font size: `0.85rem`
- Color: `var(--error)`
- Background: `rgba(248, 81, 73, 0.1)`
- Border: `1px solid rgba(248, 81, 73, 0.3)`
- Border radius: `6px`
- Line height: `var(--lh-small)` (1.5)

**Error Icon:**
- Width: `16px`
- Height: `16px`
- Flex shrink: `0`
- Margin top: `1px`
- `aria-hidden="true"`

### Accessibility Requirements

#### ARIA Attributes
- `aria-describedby`: Links input to help text and error messages
- `aria-invalid`: Set to `true` when error is present
- `aria-required`: Set to `true` for required fields
- `aria-live="polite"`: On error messages for dynamic announcements

#### Focus Management
- Keyboard navigation follows logical tab order
- Focus rings are clearly visible (2px solid accent with 2px offset)
- Focus states use high-contrast colors

#### Screen Reader Support
- Labels are programmatically associated with inputs
- Required indicator is announced as "required"
- Help text is announced when field receives focus
- Error messages are announced when they appear
- Error messages use `role="alert"` implicitly via `aria-live`

### Checkbox and Radio Variants

For checkbox and radio inputs, use the `.form-field--checkbox` or `.form-field--radio` modifier:

```typescript
<div className="form-field form-field--checkbox">
  <input
    id="accept-terms"
    type="checkbox"
    checked={accepted}
    onChange={handleChange}
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

**Layout:**
- Flex direction: `row`
- Align items: `flex-start`
- Gap: `var(--space-md)` (0.75rem)
- Margin bottom: `var(--space-lg)` (1rem)

**Input:**
- Width: `auto`
- Margin top: `2px` (aligns with label baseline)
- Cursor: `pointer`

**Label:**
- Cursor: `pointer`
- User select: `none`

### Custom Input Variant

For specialized inputs (file uploads, custom controls), use the `as="custom"` prop:

```typescript
<FormField
  id="file-upload"
  label="Upload Document"
  helpText="PDF or CSV files only"
  error={fileError}
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

The render prop receives:
- `id`: The field ID
- `aria-describedby`: Space-separated IDs of help text and error
- `aria-invalid`: Boolean indicating error state
- `aria-required`: Boolean indicating required state

### Implementation Locations

The standardized pattern has been applied to:

1. **Authentication Flows**
   - `LoginPage.tsx`: Email/username and password fields
   - `RegisterPage.tsx`: Email, password, and confirm password fields
   - `ForgotPasswordPage.tsx`: Email field
   - `ResetPasswordPage.tsx`: New password and confirm password fields

2. **Functional Components**
   - `AmountInput.tsx`: Amount to draw field with custom styling
   - `RequestEvaluation.tsx`: File upload and checkbox fields

### Validation Guidelines

- Validate on blur for better UX (don't show errors while typing)
- Clear errors when user starts correcting the field
- Use field-specific errors when possible (`error?.field === 'email'`)
- Provide actionable error messages ("Please enter a valid email" not "Invalid input")
- For password fields, show strength indicators with `aria-live="polite"`

### Testing Checklist

- [ ] Label is programmatically associated with input
- [ ] Required fields show asterisk and announce "required"
- [ ] Help text is linked via `aria-describedby`
- [ ] Error messages appear with `aria-invalid="true"`
- [ ] Error messages use `aria-live="polite"` for announcements
- [ ] Focus rings are clearly visible
- [ ] Keyboard navigation (Tab/Shift+Tab) follows logical order
- [ ] Screen reader announces label, required status, help text, and errors
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text)
- [ ] Form can be completed using keyboard only

### Reduced Motion

For users with `prefers-reduced-motion: reduce`:
- All transitions are disabled
- Animations are removed
- Focus changes are instant

```css
@media (prefers-reduced-motion: reduce) {
  .form-field__input,
  .form-field__textarea {
    transition: none;
  }
}
```

### Code Example: Complete Form

```typescript
import { useState } from 'react';
import { FormField } from '@/components/FormField';
import { PendingButton } from '@/components/PendingButton';

function LoginForm() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validation and submission logic
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField
        id="email"
        label="Email Address"
        type="email"
        required
        helpText="We'll never share your email"
        error={errors.email}
        inputProps={{
          value: formData.email,
          onChange: (e) => setFormData({ ...formData, email: e.target.value }),
          placeholder: "you@example.com",
          autoComplete: "email"
        }}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        required
        error={errors.password}
        inputProps={{
          value: formData.password,
          onChange: (e) => setFormData({ ...formData, password: e.target.value }),
          placeholder: "Enter your password",
          autoComplete: "current-password"
        }}
      />

      <PendingButton
        type="submit"
        pending={loading}
        pendingLabel="Signing in..."
        className="w-full"
      >
        Sign In
      </PendingButton>
    </form>
  );
}
```

