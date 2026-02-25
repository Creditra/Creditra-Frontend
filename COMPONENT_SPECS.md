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
