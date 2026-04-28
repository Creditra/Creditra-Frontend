# Accessibility Guidelines

This document outlines the strategy for ensuring and maintaining WCAG 2.1/2.2 AA compliance across the Creditra platform.

## 🎯 WCAG COMPLIANCE STRATEGY
Our goal is to achieve 100% compliance with AA standards by focusing on:
1. **Perceivability**: Ensuring all information is available in multiple formats (text equivalents for visuals).
2. **Operability**: Making all functionality accessible via keyboard and pointing devices.
3. **Understandability**: Providing clear instructions and error guidance.
4. **Robustness**: Supporting broad assistive technology including screen readers and voice control.

## 🎨 DESIGN RULES
- **Contrast**: Maintain 4.5:1 for text and 3:1 for large text/icons.
- **Color**: Never rely on color alone to convey meaning (always use text or symbols).
- **Typography**: Minimum 16px font size for body text; always use relative units (`rem`).
- **Focus**: Distinct, high-contrast focus rings for every interactive element.

## 🛠️ DEVELOPER IMPLEMENTATION GUIDE
### 1. Semantic Markup
Use the most specific HTML tag for its purpose.
- `button` for actions.
- `a` for navigation.
- `header`, `main`, `footer`, `nav`, `article`, `section` for layout.

### 2. ARIA Best Practices
- Use `aria-label` for buttons containing only icons.
- Use `aria-expanded` and `aria-haspopup` for dropdown triggers.
- Ensure all images have `alt` attributes (empty `alt=""` for decorative ones).

### 3. Focus Management
- Implement focus trapping in all modals using a standardized utility.
- Ensure logical `tabindex` order (following visual layout).
- Use `aria-modal="true"` for dialogs.

### 4. Reduced Motion
- Minimize animations for users who prefer reduced motion.
- CSS: `@media (prefers-reduced-motion: reduce) { ... }`

## 🧪 AUTOMATED TESTING
- **CI/CD Integration**: Run `axe-core` tests on every pull request.
- **Manual Verification**: Perform keyboard-only and screen reader walkthroughs before every release.

## 📱 TOUCH TARGET RULES

### Minimum Size
All interactive elements must meet a **minimum touch target of 44×44 CSS pixels**, per:
- WCAG 2.5.5 (Target Size, Level AAA) — recommended 44×44px
- WCAG 2.5.8 (Target Size Minimum, Level AA, WCAG 2.2) — minimum 24×24px with adequate spacing
- Apple Human Interface Guidelines — 44×44pt minimum
- Google Material Design — 48×48dp recommended

Use `min-width` / `min-height` rather than fixed `width` / `height` so the element can grow with content.

### Implementation Pattern
```css
/* Icon-only button */
.icon-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 0.625rem;          /* 10px — fills the 44px target around a ~24px icon */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Text button that must stay compact horizontally */
.compact-text-btn {
  min-height: 44px;
  padding: 0.625rem 0.5rem;
  display: inline-flex;
  align-items: center;
}
```

### Audited Components (as of this PR)
| Component | Element | Before | After | Compliant |
|---|---|---|---|---|
| `NotificationBell` | `.notif-bell` | ~30×30px | 44×44px | ✅ |
| `WalletConnectionModal` | `.close-btn` | 32×32px | 44×44px | ✅ |
| `NotificationCenter` | `.nc-icon-btn` | ~24×24px | 44×44px | ✅ |
| `NotificationCenter` | `.nc-close-btn` | ~24×24px | 44×44px | ✅ |
| `NotificationCenter` | `.nc-text-btn` | ~20px h | 44px h | ✅ |
| `NotificationCenter` | `.nc-filter-tab` | ~20px h | 44px h | ✅ |
| `NotificationCenter` | `.nc-item-action` | ~20px h | 44px h | ✅ |
| `BannerAlert` | `.banner-close` | ~20×20px | 44×44px | ✅ |
| `BannerAlert` | `.banner-action` | ~20px h | 44px h | ✅ |
| `ToastContainer` | `.toast-close` | ~20×20px | 44×44px | ✅ |
| `Dashboard` | `.wallet-address-chip` | ~32px h | 44px h | ✅ |
| `WalletButton` | `.connect-wallet-btn` | 44px h | 44px h | ✅ (was already compliant) |
| `WalletButton` | `.wallet-address-btn` | 44px h | 44px h | ✅ (was already compliant) |
| `WalletButton` | `.disconnect-btn` | 44px h | 44px h | ✅ (was already compliant) |

### Exceptions
- `network-badge` — display-only indicator, not interactive. No touch target required.
- `nc-badge` / `notif-bell-badge` — decorative count badges, not interactive.
- `status-badge` / `status-dot` — informational only, not interactive.
- Progress bars and utilization bars — not interactive.
