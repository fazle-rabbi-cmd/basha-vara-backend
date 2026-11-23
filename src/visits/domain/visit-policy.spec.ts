import { describe, it, expect } from 'vitest';
import { VisitPolicy } from './visit-policy.js';

describe('VisitPolicy', () => {
  describe('parseSlotDateTime', () => {
    it('correctly parses date and 24h time in Asia/Dhaka (+06:00)', () => {
      const dt = VisitPolicy.parseSlotDateTime('2026-12-01', '14:30');
      expect(dt.toISOString()).toBe('2026-12-01T08:30:00.000Z'); // 14:30 +06:00 is 08:30 UTC
    });

    it('correctly parses 12h time with AM/PM', () => {
      const dt = VisitPolicy.parseSlotDateTime('2026-12-01', '10:00 AM');
      expect(dt.toISOString()).toBe('2026-12-01T04:00:00.000Z'); // 10:00 +06:00 is 04:00 UTC

      const dtPm = VisitPolicy.parseSlotDateTime('2026-12-01', '03:15 PM');
      expect(dtPm.toISOString()).toBe('2026-12-01T09:15:00.000Z'); // 15:15 +06:00 is 09:15 UTC
    });
  });

  describe('isBlockedByCutoff', () => {
    const fixedNow = new Date('2026-12-01T06:00:00.000Z'); // 12:00 PM Dhaka time

    it('blocks cancellation when within 2h cutoff window (e.g. 1 hour away)', () => {
      // 1:00 PM Dhaka time is 07:00 UTC (1 hour from now)
      const isBlocked = VisitPolicy.isBlockedByCutoff('2026-12-01', '13:00', 2, fixedNow);
      expect(isBlocked).toBe(true);
    });

    it('blocks cancellation when appointment is already in the past', () => {
      // 11:00 AM Dhaka time is 05:00 UTC (past)
      const isBlocked = VisitPolicy.isBlockedByCutoff('2026-12-01', '11:00', 2, fixedNow);
      expect(isBlocked).toBe(true);
    });

    it('allows cancellation when outside cutoff window (e.g. 4 hours away)', () => {
      // 4:00 PM Dhaka time is 10:00 UTC (4 hours from now)
      const isBlocked = VisitPolicy.isBlockedByCutoff('2026-12-01', '16:00', 2, fixedNow);
      expect(isBlocked).toBe(false);
    });
  });

  describe('doSlotsOverlap', () => {
    it('detects overlap for identical slots', () => {
      const slotA = { date: '2026-12-01', time: '10:00' };
      const slotB = { date: '2026-12-01', time: '10:00' };
      expect(VisitPolicy.doSlotsOverlap(slotA, slotB, 45)).toBe(true);
    });

    it('detects overlap when second slot starts 30m after first (within 45m duration)', () => {
      const slotA = { date: '2026-12-01', time: '10:00' };
      const slotB = { date: '2026-12-01', time: '10:30' };
      expect(VisitPolicy.doSlotsOverlap(slotA, slotB, 45)).toBe(true);
    });

    it('does not overlap when slots are spaced apart (e.g. 1 hour gap)', () => {
      const slotA = { date: '2026-12-01', time: '10:00' };
      const slotB = { date: '2026-12-01', time: '11:00' };
      expect(VisitPolicy.doSlotsOverlap(slotA, slotB, 45)).toBe(false);
    });

    it('does not overlap on different dates', () => {
      const slotA = { date: '2026-12-01', time: '10:00' };
      const slotB = { date: '2026-12-02', time: '10:00' };
      expect(VisitPolicy.doSlotsOverlap(slotA, slotB, 45)).toBe(false);
    });
  });

  describe('validateProposedSlots', () => {
    const fixedNow = new Date('2026-12-01T00:00:00.000Z');

    it('accepts 1 to 3 valid future candidate slots', () => {
      const slots = [
        { date: '2026-12-02', time: '10:00' },
        { date: '2026-12-02', time: '15:00' },
        { date: '2026-12-03', time: '11:00' },
      ];
      expect(() => VisitPolicy.validateProposedSlots(slots, 3, fixedNow)).not.toThrow();
    });

    it('throws when slots array is empty', () => {
      expect(() => VisitPolicy.validateProposedSlots([], 3, fixedNow)).toThrow(
        /propose at least 1 candidate visit slot/i,
      );
    });

    it('throws when tenant proposes more than 3 slots', () => {
      const slots = [
        { date: '2026-12-02', time: '10:00' },
        { date: '2026-12-02', time: '11:00' },
        { date: '2026-12-02', time: '14:00' },
        { date: '2026-12-02', time: '16:00' },
      ];
      expect(() => VisitPolicy.validateProposedSlots(slots, 3, fixedNow)).toThrow(
        /cannot propose more than 3/i,
      );
    });

    it('throws when slot is in the past', () => {
      const slots = [{ date: '2026-11-20', time: '10:00' }];
      expect(() => VisitPolicy.validateProposedSlots(slots, 3, fixedNow)).toThrow(
        /must be in the future/i,
      );
    });
  });

  describe('Quotas & Limits', () => {
    it('detects daily quota exhaustion (limit 5)', () => {
      expect(VisitPolicy.isDailyQuotaExceeded(4, 5)).toBe(false);
      expect(VisitPolicy.isDailyQuotaExceeded(5, 5)).toBe(true);
      expect(VisitPolicy.isDailyQuotaExceeded(6, 5)).toBe(true);
    });

    it('detects existing active request on listing (limit 1)', () => {
      expect(VisitPolicy.hasActiveRequestOnListing(0, 1)).toBe(false);
      expect(VisitPolicy.hasActiveRequestOnListing(1, 1)).toBe(true);
    });
  });
});
