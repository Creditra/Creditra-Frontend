import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ICON, TYPE_COLOR, TYPE_ICON } from './notificationIcons';
import type { NotificationCategory, NotificationType } from '../../types/notification';

const NOTIFICATION_TYPES = [
  'success',
  'info',
  'warning',
  'error',
  'danger',
] as const satisfies readonly NotificationType[];

const NOTIFICATION_CATEGORIES = [
  'transaction',
  'credit_line',
  'risk_score',
  'rate_change',
  'auction',
  'system',
] as const satisfies readonly NotificationCategory[];

type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// Keep the explicit lists in sync with the unions so new types/categories require test updates.
const typeListIsComplete: Assert<IsEqual<NotificationType, (typeof NOTIFICATION_TYPES)[number]>> = true;
const categoryListIsComplete: Assert<IsEqual<NotificationCategory, (typeof NOTIFICATION_CATEGORIES)[number]>> = true;
void typeListIsComplete;
void categoryListIsComplete;

describe('notification icon mappings', () => {
  it('provides an icon and color mapping for every notification type', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(TYPE_ICON[type]).toBeDefined();
      expect(TYPE_COLOR[type]).toBeDefined();
    }
  });

  it('renders every type icon as a decorative SVG', () => {
    for (const type of NOTIFICATION_TYPES) {
      const { container, unmount } = render(TYPE_ICON[type]);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');

      unmount();
    }
  });

  it('provides a non-empty icon for every notification category', () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_ICON[category]).toEqual(expect.any(String));
      expect(CATEGORY_ICON[category].trim()).not.toBe('');
    }
  });

  it('provides all color properties for every notification type', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(TYPE_COLOR[type]).toEqual(
        expect.objectContaining({
          bg: expect.any(String),
          border: expect.any(String),
          icon: expect.any(String),
          text: expect.any(String),
        }),
      );
    }
  });
});
