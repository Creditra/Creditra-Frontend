# Wallet Connection & Onboarding Flow Documentation

## Overview
Complete implementation of wallet connection and first-time user onboarding for Creditra Frontend, supporting Freighter and Albedo Stellar wallets.

## Features Implemented

### 1. Wallet Connection Modal
- **Location**: `src/components/WalletConnectionModal.tsx`
- **Features**:
  - Support for Freighter and Albedo wallets
  - Connection status indicators (connecting, connected, error)
  - Error handling with user-friendly messages
  - Loading states during connection
  - Success confirmation
  - Security note about private key safety

### 2. Onboarding Flow
- **Location**: `src/components/OnboardingFlow.tsx`
- **Features**:
  - 3-step welcome flow for first-time users
  - Skip option
  - Progress indicators
  - Animated transitions
  - Persistent state (won't show again after completion)

### 3. Wallet Button
- **Location**: `src/components/WalletButton.tsx`
- **Features**:
  - Connect wallet button (when disconnected)
  - Address display with status indicator (when connected)
  - Dropdown menu showing wallet type and network
  - Disconnect functionality
  - Automatic onboarding trigger for new users

### 4. Wallet Context
- **Location**: `src/context/WalletContext.tsx`
- **Features**:
  - Global wallet state management
  - Connection status tracking
  - Error handling
  - Persistent wallet preference (localStorage)
  - Auto-reconnect on page reload

### 5. Wallet Utilities
- **Location**: `src/utils/wallet.ts`
- **Features**:
  - Wallet detection
  - Connection logic for Freighter and Albedo
  - Network validation
  - LocalStorage management

## User Flows

### Happy Path - First Time User
1. User clicks "Connect Wallet" button
2. Modal opens with wallet options
3. User selects Freighter or Albedo
4. Wallet extension prompts for approval
5. Connection succeeds
6. Success message displays
7. Modal closes
8. Onboarding flow starts (3 steps)
9. User completes or skips onboarding
10. Wallet button shows connected state

### Happy Path - Returning User
1. Page loads
2. Wallet auto-connects from localStorage
3. Wallet button shows connected state
4. No onboarding shown

### Error Paths

#### Wallet Not Found
- User selects wallet that isn't installed
- Error message: "Wallet not found. Please install the extension."
- User can try another wallet or close modal

#### Connection Failed
- User rejects connection in wallet
- Error message: "Failed to connect wallet. Please try again."
- User can retry

#### Wrong Network
- Wallet is on non-Stellar network
- Error message: "Please switch to Stellar network in your wallet."
- User must switch network and retry

## Component Specifications

### WalletConnectionModal
```typescript
Props:
- isOpen: boolean
- onClose: () => void
- onSuccess?: () => void

States:
- Disconnected (default)
- Connecting (loading spinner)
- Connected (success icon)
- Error (error message)
```

### OnboardingFlow
```typescript
Props:
- isOpen: boolean
- onComplete: () => void
- onSkip: () => void

Steps:
1. Welcome to Creditra
2. Credit Evaluation explanation
3. Flexible Credit Lines explanation
```

### WalletButton
```typescript
States:
- Disconnected: Shows "Connect Wallet" button
- Connected: Shows address with dropdown
  - Dropdown shows: wallet type, network, disconnect button
```

## Design Specifications

### Colors (from index.css)
- Background: `#0d1117`
- Surface: `#161b22`
- Border: `#30363d`
- Text: `#e6edf3`
- Muted: `#8b949e`
- Accent: `#58a6ff`
- Success: `#3fb950`
- Warning: `#d29922`
- Error: `#f85149`

### Modal Overlay
- Background: `rgba(0, 0, 0, 0.7)` with blur
- Animation: Fade in + slide up

### Wallet Cards
- Background: `var(--bg)`
- Border: `var(--border)`
- Hover: Border changes to accent, slight lift
- Icon size: 48x48px
- Padding: 1rem

### Buttons
- Primary: Accent color background, white text
- Secondary: Outline style with border
- Hover: Slight lift with shadow

### Status Indicators
- Connected: Green dot with pulse animation
- Loading: Spinning border animation
- Error: Red background with warning icon

## Microcopy Guidelines

### Connection Modal
- Title: "Connect Wallet"
- Description: "Choose a wallet to connect to Creditra. Your wallet will be used to access credit lines on Stellar."
- Security note: "We never store your private keys. Your wallet remains secure."

### Error Messages
- Not found: "[Wallet Name] wallet not found. Please install the extension."
- Connection failed: "Failed to connect wallet. Please try again."
- Wrong network: "Please switch to Stellar network in your wallet."

### Success State
- Title: "Wallet Connected!"
- Message: "You're all set to start using Creditra"

### Onboarding
- Step 1: "Welcome to Creditra" - "Your adaptive credit protocol on Stellar blockchain"
- Step 2: "Credit Evaluation" - "We analyze your on-chain activity to determine your credit limit and terms"
- Step 3: "Flexible Credit Lines" - "Draw and repay credit as needed with dynamic interest rates based on your risk profile"

## Technical Notes

### Wallet Integration
Currently uses mock wallet detection. To integrate real wallets:

1. **Freighter**: Install `@stellar/freighter-api`
```typescript
import { isConnected, getPublicKey, getNetwork } from "@stellar/freighter-api";
```

2. **Albedo**: Install `@albedo-link/intent`
```typescript
import albedo from '@albedo-link/intent';
```

### LocalStorage Keys
- `wallet_info`: Stores connected wallet information
- `wallet_preference`: Stores preferred wallet type
- `onboarding_completed`: Tracks onboarding completion

### State Management
Uses React Context API for global wallet state. All components can access wallet info via `useWallet()` hook.

## Testing Checklist

- [ ] Connect with Freighter wallet
- [ ] Connect with Albedo wallet
- [ ] Handle wallet not installed error
- [ ] Handle connection rejection
- [ ] Handle wrong network error
- [ ] Verify success state displays
- [ ] Verify onboarding shows for first-time users
- [ ] Verify onboarding doesn't show for returning users
- [ ] Verify skip onboarding works
- [ ] Verify wallet auto-reconnects on page reload
- [ ] Verify disconnect functionality
- [ ] Verify dropdown menu works
- [ ] Verify all animations work smoothly
- [ ] Test on mobile viewport
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility

## Future Enhancements

1. Add more wallet options (xBull, Rabet)
2. Add wallet switching without disconnect
3. Add transaction signing capabilities
4. Add network switching UI
5. Add wallet balance display
6. Add recent transactions
7. Add QR code for mobile wallet connection
8. Add biometric authentication option
9. Add multi-wallet support
10. Add wallet activity logging

## File Structure
```
src/
├── components/
│   ├── WalletConnectionModal.tsx
│   ├── WalletConnectionModal.css
│   ├── OnboardingFlow.tsx
│   ├── OnboardingFlow.css
│   ├── WalletButton.tsx
│   └── WalletButton.css
├── context/
│   └── WalletContext.tsx
├── types/
│   └── wallet.ts
└── utils/
    └── wallet.ts
```

## Usage Example

```typescript
// In any component
import { useWallet } from '../context/WalletContext';

function MyComponent() {
  const { wallet, status, connect, disconnect } = useWallet();
  
  if (status === 'connected' && wallet) {
    return <div>Connected: {wallet.publicKey}</div>;
  }
  
  return <button onClick={() => connect('freighter')}>Connect</button>;
}
```
