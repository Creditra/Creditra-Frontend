# Alert Hierarchy

## Overview

The Creditra design system uses a standardized alert hierarchy across all notifications and inline messaging. This ensures consistent communication of system states, validation outcomes, and contextual feedback.

The system relies on four primary alert types: **Danger**, **Warning**, **Info**, and **Success**.

## Alert Types

### Danger

- **Purpose**: Critical errors, destructive actions, and severe system failures.
- **Color Token**: `--danger` (`#f85149`)
- **Iconography**: ✕ (Banner), `AlertCircle` (Inline)
- **Usage**:
  - Failed transactions
  - Invalid form submissions
  - Application rejections
  - Disconnected wallets

### Warning

- **Purpose**: Precautionary information, potential issues, or actions that require careful review.
- **Color Token**: `--warning` (`#d29922`)
- **Iconography**: ⚠ (Banner), `AlertTriangle` (Inline)
- **Usage**:
  - Approaching credit limits
  - High-risk score changes
  - Temporary network congestion

### Info

- **Purpose**: Neutral system information, updates, or helpful context.
- **Color Token**: `--info` (`#58a6ff`)
- **Iconography**: ℹ (Banner), `Info` (Inline)
- **Usage**:
  - New feature announcements
  - Evaluation in progress states
  - General system maintenance notices

### Success

- **Purpose**: Confirmation of successful actions and positive outcomes.
- **Color Token**: `--success` (`#3fb950`)
- **Iconography**: ✓ (Banner), `CheckCircle` (Inline)
- **Usage**:
  - Transactions completed
  - Credit line approved
  - Profile saved
  - Wallet connected successfully

## Components

### 1. BannerAlert (`BannerAlert.tsx`)

Used for global, transient, or critical page-level notifications. It appears at the top of the screen or in a toast container.

- **Accessibility**: Uses `role="alert"` and maintains high contrast ratios for both text and icons against the tinted background.
- **Examples**:
  ```tsx
  // Triggered via NotificationContext
  addBanner({ type: "success", message: "Wallet connected successfully" });
  addBanner({ type: "danger", message: "Transaction failed to broadcast" });
  ```

### 2. FormMessage (`FormMessage.tsx`)

Used for inline validation or localized context (e.g., within forms, cards, or specific sections). It can be used as a simple inline message or a larger alert box.

- **Props**:
  - `type`: `"success" | "danger" | "warning" | "info"`
  - `tone`: `"inline" | "alert"`
- **Accessibility**: Includes an `aria-live="assertive"` container and `role="alert"` for screen readers. Icons are marked `aria-hidden="true"`.
- **Examples**:

  ```tsx
  // Large inline alert
  <FormMessage
    type="danger"
    tone="alert"
    title="Evaluation failed"
    message="A network error occurred while analyzing your wallet. Please try again."
  />

  // Small inline validation
  <FormMessage
    type="warning"
    tone="inline"
    message="Your credit score is slightly below the recommended threshold."
  />
  ```

### 3. ToastContainer (`ToastContainer.tsx`)

Used for transient page-level notifications that appear briefly in the upper-right corner.

- **Accessibility**: Uses `role="alert"` and `aria-live="assertive"` for destructive states (`danger` / `error`) and `aria-live="polite"` for informational states.
- **Behavior**: Toasts automatically dismiss after a duration unless marked `persistent`.
- **Examples**:

  ```tsx
  addToast({
    type: "success",
    title: "Connection complete",
    message: "Your Stellar wallet is now connected.",
  });

  addToast({
    type: "danger",
    title: "Transaction failed",
    message: "Your payment could not be completed.",
  });
  ```

## Accessibility & Copy Rules

- **Non-color cues**: Never rely on color alone to convey meaning. Always include the correct icon and clear, descriptive copy.
- **Contrast**: The alert text uses the base text color on a low-opacity tinted background, while titles and icons use the high-contrast accent colors.
- **Copy Guidelines**:
  - Be concise and direct.
  - For **Danger/Error**, explain _what_ went wrong and _how_ to fix it.
  - Avoid technical jargon unless necessary (e.g., "Network timeout" instead of "TCP socket hang up").
