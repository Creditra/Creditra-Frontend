# Linked Accounts Feature

## Overview

The Linked Accounts feature allows users to connect external accounts (Google, GitHub, Twitter, Facebook) to their Creditra profile. This integration enhances credit evaluation and enables additional features.

## Architecture

### Components

- **LinkedAccounts Page** (`src/pages/LinkedAccounts.tsx`)
  - Main UI for managing linked accounts
  - Provider cards with connect/disconnect/reconnect actions
  - Success/error messaging with dismissible banners
  - Loading states with skeleton placeholders

### Service Layer

- **linkedAccounts Service** (`src/services/linkedAccounts.ts`)
  - API integration for account linking operations
  - OAuth flow initiation and completion
  - Account verification and status management
  - Mock implementation with localStorage persistence

### Types

- **linkedAccount Types** (`src/types/linkedAccount.ts`)
  - `AccountProvider`: Supported OAuth providers
  - `ConnectionStatus`: Account connection states
  - `LinkedAccount`: Account data model
  - `AccountLinkError`: Error handling types

## User Flows

### Connect New Account (with Pending State)

1. User clicks "Connect" button on provider card.
2. System initiates OAuth flow via `initiateLinkAccount()`, writing a pending account record (`status: 'pending'`) and OAuth state token with a timestamp.
3. The provider card transitions immediately to a visible pending state:
   - Displays "Waiting for [Provider] authorization…".
   - Shows a "Cancel" button to abandon the pending link.
   - Provider card `aria-label` announces `[Provider] account pending`.
4. Browser redirects to the provider's OAuth authorization URL (`redirect(response.authUrl)`).
5. **No success message** is shown at this stage.
6. Upon return from OAuth authorization:
   - If callback parameters (`code` and `state`) are present, `completeOAuthLink()` validates the state token and creates the connected account record (`status: 'connected'`).
   - Only after successful completion is the success message (`"[Provider] account linked"`) displayed in an `aria-live="polite"` status region.
   - If the user returns to `/linked-accounts` with a pending entry but no callback parameters, an alert banner is displayed ("Linking was not completed") with **Retry** and **Cancel** actions.

### Pending Expiry and Pruning

- Pending state tokens and pending account entries have a 10-minute TTL (`OAUTH_STATE_TTL_MS = 600,000 ms`).
- On `fetchLinkedAccounts()`, any pending entries older than 10 minutes are identified as expired and pruned from storage automatically.
- Users can manually cancel a pending link via `cancelLinkAccount(provider)` or by clicking the Cancel button on the pending card or incomplete link alert banner.
- A pending entry on one provider never blocks connecting or interacting with a different provider.

### Disconnect Account

1. User clicks "Disconnect" button on connected account
2. Confirmation dialog appears
3. If confirmed, `disconnectAccount()` marks account as disconnected
4. Success message displayed, provider card returns to unconnected state

### Reconnect Account

1. Account enters error state (expired token, provider error)
2. "Reconnect" button appears on provider card
3. User clicks reconnect, initiating new OAuth flow via `reconnectAccount()`
4. Transitions provider to pending state and redirects to authorization URL without premature success announcement
5. Completion follows OAuth callback verification

## Accessibility

### WCAG 2.1 AA Compliance

- **Keyboard Navigation**: All actions accessible via keyboard
- **ARIA Labels**: Descriptive labels on all interactive elements
- **Live Regions**: Status announcements via `aria-live="polite"`
- **Focus Management**: Proper focus indicators and order
- **Touch Targets**: Minimum 44×44px for all buttons
- **Contrast**: AA-compliant color ratios throughout

### Specific Implementations

```tsx
// Provider card with semantic ARIA
<div role="article" aria-label={`${provider} account ${isConnected ? 'connected' : 'not connected'}`}>
  
// Success banner with live region
<div role="status" aria-live="polite">

// Error banner with alert role
<div role="alert">

// Action buttons with descriptive labels
<button aria-label="Connect Google account">
```

## Security

### OAuth 2.0 Flow

1. **State Token**: CSRF protection via state parameter
2. **Token Expiry**: 10-minute OAuth session timeout
3. **Verification**: State token validated on callback
4. **No Credential Storage**: Credentials never stored locally

### Open Redirect Protection

The post-link return path (`redirectUrl`) is attacker-controlled, so it is
never embedded in the OAuth URL or written to storage verbatim.

- `safeReturnPath` (`src/utils/safe-redirect.ts`) sanitises the value on the
  way in and `initiateLinkAccount` stores only the sanitised result alongside
  the OAuth state. The OAuth URL carries the state token only.
- On the callback, the stored return path is re-validated and the caller
  navigates only to a value the app itself stored.

A return path is accepted only when all of the following hold:

- It is a string of at most 512 characters.
- It starts with a single `/` (not `//` or `/\`).
- It contains no control characters or backslashes.
- It parses with `new URL(input, window.location.origin)` to the same origin.
- Its pathname is the root `/` or starts with an allowlisted route prefix.

Allowed route prefixes: `/linked-accounts`, `/profile`, `/settings`, `/open-credit`, and the root `/`.

Anything else silently falls back to `/linked-accounts`. In development
(`import.meta.env.DEV`) a warning is logged with the rejected value.

#### Extending the allowlist

Add a new route prefix to `ALLOWED_PREFIXES` in `src/utils/safe-redirect.ts`:

```typescript
const ALLOWED_PREFIXES = [
  '/linked-accounts',
  '/profile',
  '/settings',
  '/open-credit',
  '/invoices', // <- new in-app route
];
```

No other changes are required; `safeReturnPath` applies the same origin and
length checks to every prefix.

### Data Privacy

- External IDs (emails) displayed but not editable
- Account data persisted in localStorage (development only)
- Production implementation uses secure backend storage
- User can disconnect any account at any time

## Testing

### Unit Tests

**Service Tests** (`src/services/__tests__/linkedAccounts.test.ts`)
- Fetch linked accounts
- Initiate OAuth flow
- Complete OAuth callback
- Disconnect/reconnect operations
- Error handling and edge cases

**Component Tests** (`src/pages/LinkedAccounts.test.tsx`)
- Rendering provider cards
- Loading states
- Connect/disconnect/reconnect actions
- Success/error messaging
- Keyboard accessibility
- ARIA attributes

### Test Coverage

Run tests with:
```bash
npm run test src/services/__tests__/linkedAccounts.test.ts
npm run test src/pages/LinkedAccounts.test.tsx
```

## Styling

### Design Tokens

All styles use design system tokens:
- Colors: `var(--text)`, `var(--accent)`, `var(--success)`, `var(--error)`
- Spacing: `var(--space-xs)` through `var(--space-2xl)`
- Radius: `var(--radius-md)`
- Typography: `var(--lh-body)`, `var(--lh-small)`

### Responsive Design

- **Desktop**: 2-column grid (min 320px columns)
- **Tablet**: Adapts to available width
- **Mobile**: Single column layout, stacked actions

### Dark Mode

Fully supports dark theme via design token system. No hardcoded colors.

## API Integration (Production)

### Endpoints

```typescript
// Fetch user's linked accounts
GET /api/linked-accounts
Response: LinkedAccount[]

// Initiate OAuth flow
POST /api/linked-accounts/initiate
Body: { provider: AccountProvider, redirectUrl?: string }
Response: { authUrl: string, state: string }

// Complete OAuth callback
POST /api/linked-accounts/callback
Body: { provider: AccountProvider, code: string, state: string }
Response: LinkedAccount

// Disconnect account
DELETE /api/linked-accounts/:accountId
Response: { success: boolean }

// Reconnect account
POST /api/linked-accounts/:accountId/reconnect
Response: { authUrl: string, state: string }

// Verify account status
POST /api/linked-accounts/:accountId/verify
Response: LinkedAccount
```

## Configuration

### Adding New Providers

1. Add provider to `AccountProvider` type in `src/types/linkedAccount.ts`
2. Add provider info to `PROVIDER_INFO` in `src/services/linkedAccounts.ts`
3. Provider automatically appears in UI

Example:
```typescript
export type AccountProvider = 'google' | 'github' | 'twitter' | 'facebook' | 'linkedin';

export const PROVIDER_INFO: Record<AccountProvider, ...> = {
  // ...existing providers
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0077b5',
  },
};
```

## Future Enhancements

### Planned Features

- [ ] Real-time sync status indicators
- [ ] Account permissions management
- [ ] Data import from linked accounts
- [ ] Multi-factor authentication via linked accounts
- [ ] Account usage analytics
- [ ] Batch operations (disconnect all)

### Backend Integration

Current implementation uses mock service with localStorage. Production requires:

1. Replace service functions with real API calls
2. Implement actual OAuth redirects
3. Add token refresh logic
4. Implement webhook handlers for provider notifications
5. Add rate limiting and retry logic

## Troubleshooting

### Common Issues

**Provider Already Linked**
- Error: "Google account is already linked"
- Solution: Disconnect existing connection first

**OAuth State Mismatch**
- Error: "Invalid OAuth state"
- Solution: Clear browser cache and retry

**Token Expired**
- Error: "OAuth session expired"
- Solution: Click reconnect button to re-authorize

**Account Not Found**
- Error: "Account not found"
- Solution: Refresh page to reload account list

## Performance

### Optimizations

- Lazy loading of provider icons
- Debounced action buttons during operations
- Skeleton loading states for perceived performance
- Efficient re-rendering via proper React keys

### Bundle Impact

- Service layer: ~3KB gzipped
- Component: ~5KB gzipped
- CSS: ~2KB gzipped
- Total: ~10KB added to bundle

## Maintenance

### Code Locations

```
src/
├── pages/
│   ├── LinkedAccounts.tsx       # Main page component
│   ├── LinkedAccounts.css       # Page styles
│   └── LinkedAccounts.test.tsx  # Component tests
├── services/
│   ├── linkedAccounts.ts        # API service layer
│   └── __tests__/
│       └── linkedAccounts.test.ts # Service tests
└── types/
    └── linkedAccount.ts         # TypeScript types
```

### Updating Dependencies

Service depends on:
- `src/utils/storage.ts` - localStorage wrappers
- `lucide-react` - Icons
- `src/components/Skeleton.tsx` - Loading states
- `src/components/PendingButton.tsx` - Action buttons

## Related Documentation

- [Authentication Guide](./AUTH_GUIDE.md)
- [Accessibility Standards](./ACCESSIBILITY.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Testing Guide](./TESTING.md)
