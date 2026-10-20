# Success State Patterns

This document defines the consistent UI/UX patterns for success feedback within the Creditra protocol dashboard.

## 🎯 Purpose

To provide clear, accessible, and actionable feedback after key protocol actions (Draw, Repay, Evaluation), ensuring users trust the system state and know what to do next without relying solely on temporary toast notifications.

## 🧱 Component: SuccessState

A dedicated inline component that replaces the task flow UI upon successful completion.

### Key Elements

1. **Animated Icon**: A visual confirmation using the brand success color (#3fb950).
2. **Action Confirmation**: A clear title stating what happened (e.g., "Repayment Successful").
3. **Contextual Description**: A brief sentence confirming the result.
4. **"What's Next" Guidance**: A highlighted section explaining expected confirmation times or dashboard updates.
5. **Primary Actions**: Buttons to return to the dashboard or navigate to Transaction History.
6. **Explorer Link**: Direct link to the Stellar explorer for transaction hash verification.

## 📋 Copy Guidelines

| Action         | Title                  | Description (What Happened)                                                            | Next Step (What's Next)                                                                   |
| -------------- | ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Draw**       | Draw Request Submitted | Your request for a credit draw has been successfully submitted to the Stellar network. | Once confirmed, your credit line balance will be updated (~5-10s).                        |
| **Repay**      | Repayment Successful   | Your repayment has been processed successfully.                                        | Your available credit limit has been restored. You can now request further draws.         |
| **Evaluation** | Evaluation Requested   | Your credit evaluation request has been sent for analysis.                             | Our adaptive protocol is analyzing your activity. Your updated score will appear shortly. |

## ♿ Accessibility

- **ARIA**: The container uses `role="status"` and `aria-live="polite"` to announce completion to screen readers.
- **Contrast**: Maintains WCAG AA compliance using tokens from the Design System.
- **Keyboard**: The "Done" button is automatically focused when the state appears to allow rapid return to the main dashboard.

## 💻 Usage Example

```tsx
import SuccessState from "./components/SuccessState";

// In your flow component:
if (isComplete) {
  return (
    <SuccessState type="draw" transactionId={txHash} onClose={handleDone} />
  );
}
```
