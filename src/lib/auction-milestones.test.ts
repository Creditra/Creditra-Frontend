import { describe, it, expect } from 'vitest';
import {
  crossedMilestone,
  DEFAULT_AUCTION_MILESTONES,
  formatMilestoneAnnouncement,
} from './auction-milestones';

describe('auction-milestones', () => {
  describe('crossedMilestone', () => {
    it('detects when remaining crosses 5:00 -> 4:59 (5 minutes left)', () => {
      const prev = 5 * 60 * 1000 + 1; // 5:00.001
      const next = 4 * 60 * 1000 + 59 * 1000; // 4:59
      const milestone = crossedMilestone(prev, next);
      expect(milestone).not.toBeNull();
      expect(milestone?.label).toBe('5 minutes left');
      expect(milestone?.remainingMs).toBe(5 * 60 * 1000);
    });

    it('returns null when no milestone is crossed', () => {
      const prev = 4 * 60 * 1000;
      const next = 3 * 60 * 1000;
      expect(crossedMilestone(prev, next)).toBeNull();
    });

    it('only fires the latest crossed milestone when skipping from 6:00 to 0:30 (throttled tab)', () => {
      const prev = 6 * 60 * 1000;
      const next = 30 * 1000; // 30 seconds left (crossed 5 min and 1 min)
      const milestone = crossedMilestone(prev, next);
      expect(milestone).not.toBeNull();
      expect(milestone?.label).toBe('1 minute left');
      expect(milestone?.remainingMs).toBe(1 * 60 * 1000);
    });

    it('detects when remaining crosses into 0 (ended)', () => {
      const prev = 2000; // 2 seconds
      const next = 0;
      const milestone = crossedMilestone(prev, next);
      expect(milestone).not.toBeNull();
      expect(milestone?.label).toBe('ended');
      expect(milestone?.remainingMs).toBe(0);
    });

    it('detects when remaining drops from above 0 to negative (ended)', () => {
      const prev = 500;
      const next = -1000;
      const milestone = crossedMilestone(prev, next);
      expect(milestone).not.toBeNull();
      expect(milestone?.label).toBe('ended');
      expect(milestone?.remainingMs).toBe(0);
    });

    it('does not fire again if both prev and next are past milestone', () => {
      const prev = -100;
      const next = -1000;
      expect(crossedMilestone(prev, next)).toBeNull();
    });

    it('handles custom milestones', () => {
      const custom = [{ remainingMs: 10000, label: '10s left' }];
      expect(crossedMilestone(15000, 9000, custom)?.label).toBe('10s left');
      expect(crossedMilestone(9000, 5000, custom)).toBeNull();
    });
  });

  describe('formatMilestoneAnnouncement', () => {
    it('formats non-ended milestones with price', () => {
      const announcement = formatMilestoneAnnouncement(
        'Cosmic Ape #1234',
        { remainingMs: 60000, label: '1 minute left' },
        '$213.40'
      );
      expect(announcement).toBe('Cosmic Ape #1234: 1 minute left, current price $213.40');
    });

    it('formats ended milestone without price', () => {
      const announcement = formatMilestoneAnnouncement(
        'Cosmic Ape #1234',
        { remainingMs: 0, label: 'ended' },
        '$200.00'
      );
      expect(announcement).toBe('Cosmic Ape #1234 auction ended');
    });
  });
});
