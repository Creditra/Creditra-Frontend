import { useEffect, useRef } from 'react';
import { useNotifications } from '../../context/NotificationContext';

interface UndoToastProps {
  message: string;
  ids: string[];
  onClose: () => void;
  duration?: number;
}

export function UndoToast({ message, ids, onClose, duration = 5000 }: UndoToastProps) {
  const { addToast, dismissToast, undoRead } = useNotifications();
  const toastIdRef = useRef<string | null>(null);
  const actedRef = useRef(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = addToast({
      type: 'success',
      title: 'Marked as read',
      message,
      action: {
        label: 'Undo',
        onClick: () => {
          if (actedRef.current) return;
          actedRef.current = true;
          undoRead(idsRef.current);
          onCloseRef.current();
        },
      },
      duration,
      saveToHistory: false,
      bypassPreferences: true,
    });
    toastIdRef.current = id;

    return () => {
      if (toastIdRef.current && !actedRef.current) {
        dismissToast(toastIdRef.current);
      }
    };
  }, []);

  return null;
}
