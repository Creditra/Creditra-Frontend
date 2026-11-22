// Hook to resolve NotificationActionDescriptor to concrete behaviour
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationActionDescriptor } from '../types/notification';

// Simple command registry – can be expanded as needed
const commandHandlers: Record<string, () => void> = {
  'open-wallet': () => {
    // TODO: integrate with wallet opening logic
    console.log('open-wallet command executed');
  },
  'open-kyc': () => {
    console.log('open-kyc command executed');
  },
  'retry-sync': () => {
    console.log('retry-sync command executed');
  },
};

/**
 * Returns a click handler for a given notification action descriptor.
 * - `route` actions navigate via react‑router `useNavigate` after a simple safety check.
 * - `command` actions invoke a registered handler.
 * If the descriptor is invalid or unknown, the handler is a no‑op.
 */
export function useNotificationActionHandler() {
  const navigate = useNavigate();

  const handleAction = useCallback((action: NotificationActionDescriptor) => {
    if (!action) return;
    if (action.kind === 'route') {
      // Ensure same‑origin relative path, start with '/' and no protocol.
      if (action.to.startsWith('/') && !action.to.includes('://')) {
        navigate(action.to);
      } else {
        console.warn('Invalid route action ignored:', action.to);
      }
    } else if (action.kind === 'command') {
      const handler = commandHandlers[action.id];
      if (handler) {
        handler();
      } else {
        console.warn('Unknown command action ignored:', action.id);
      }
    } else {
      // Future kinds – safe no‑op
      console.warn('Unsupported action kind:', (action as any).kind);
    }
  }, [navigate]);

  return { handleAction };
}
