export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'danger';

export type NotificationCategory =
  | 'transaction'
  | 'credit_line'
  | 'risk_score'
  | 'rate_change'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string; // ISO
  read: boolean;
  action?: { label: string; onClick: () => void };
}

export interface Toast extends Omit<Notification, 'read'> {
  duration?: number; // ms, default 5500
  persistent?: boolean;
}

export interface BannerAlert {
  id: string;
  type: NotificationType;
  message: string;
  dismissible?: boolean;
  action?: { label: string; onClick: () => void };
}

export interface NotificationPreferences {
  transaction: boolean;
  credit_line: boolean;
  risk_score: boolean;
  rate_change: boolean;
  system: boolean;
}
