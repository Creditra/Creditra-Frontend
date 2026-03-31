import type { NotificationCategory, NotificationType } from '../../types/notification';

export const TYPE_ICON: Record<NotificationType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export const CATEGORY_ICON: Record<NotificationCategory, string> = {
  transaction: '↗',
  credit_line: '💳',
  risk_score: '🛡',
  rate_change: '📈',
  system: '⚙',
};

export const TYPE_COLOR: Record<NotificationType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'rgba(63,185,80,0.08)',
    border: 'rgba(63,185,80,0.3)',
    icon: '#3fb950',
    text: '#3fb950',
  },
  error: {
    bg: 'rgba(248,81,73,0.08)',
    border: 'rgba(248,81,73,0.3)',
    icon: '#f85149',
    text: '#f85149',
  },
  warning: {
    bg: 'rgba(210,153,34,0.08)',
    border: 'rgba(210,153,34,0.3)',
    icon: '#d29922',
    text: '#d29922',
  },
  info: {
    bg: 'rgba(88,166,255,0.08)',
    border: 'rgba(88,166,255,0.3)',
    icon: '#58a6ff',
    text: '#58a6ff',
  },
};
