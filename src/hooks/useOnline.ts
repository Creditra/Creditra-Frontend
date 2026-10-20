import { useState, useEffect, useCallback, useRef } from 'react';

type Action = () => void;

export function useOnline() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const actionQueue = useRef<Action[]>([]);
  // Optional stable keys used to de-duplicate pending actions so a repeated
  // offline trigger (double click, repeat Enter key) queues the action once.
  const queueKeys = useRef<Set<string>>(new Set());
  const [queuedActionCount, setQueuedActionCount] = useState(0);

  const processQueue = useCallback(() => {
    if (actionQueue.current.length === 0) return;

    // Process actions
    const actions = [...actionQueue.current];
    actionQueue.current = [];
    queueKeys.current.clear();
    setQueuedActionCount(0);

    actions.forEach(action => {
      try {
        action();
      } catch (error) {
        console.error('Failed to execute queued action', error);
      }
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  const queueAction = useCallback((action: Action, key?: string) => {
    if (isOnline) {
      action();
    } else {
      if (key) {
        if (queueKeys.current.has(key)) return;
        queueKeys.current.add(key);
      }
      actionQueue.current.push(action);
      setQueuedActionCount(actionQueue.current.length);
    }
  }, [isOnline]);

  const checkOnlineStatus = useCallback(() => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(online);
    if (online) {
      processQueue();
    }
    return online;
  }, [processQueue]);

  return { isOnline, queueAction, checkOnlineStatus, queuedActionCount };
}
