import { describe, it, expect } from 'vitest';
import { DomainVisitStatus, normalizeVisitStatus } from './visit-status.enum.js';
import { VisitStateMachine } from './visit-state-machine.js';

describe('VisitStateMachine', () => {
  describe('normalizeVisitStatus', () => {
    it('normalizes legacy PENDING to REQUESTED', () => {
      expect(normalizeVisitStatus('PENDING')).toBe(DomainVisitStatus.REQUESTED);
      expect(normalizeVisitStatus('pending')).toBe(DomainVisitStatus.REQUESTED);
    });

    it('normalizes legacy ACCEPTED to CONFIRMED', () => {
      expect(normalizeVisitStatus('ACCEPTED')).toBe(DomainVisitStatus.CONFIRMED);
      expect(normalizeVisitStatus('accepted')).toBe(DomainVisitStatus.CONFIRMED);
    });

    it('passes through canonical statuses unchanged', () => {
      expect(normalizeVisitStatus('REQUESTED')).toBe(DomainVisitStatus.REQUESTED);
      expect(normalizeVisitStatus('CONFIRMED')).toBe(DomainVisitStatus.CONFIRMED);
      expect(normalizeVisitStatus('RESCHEDULE_PROPOSED')).toBe(DomainVisitStatus.RESCHEDULE_PROPOSED);
      expect(normalizeVisitStatus('DECLINED')).toBe(DomainVisitStatus.DECLINED);
      expect(normalizeVisitStatus('CANCELLED')).toBe(DomainVisitStatus.CANCELLED);
      expect(normalizeVisitStatus('EXPIRED')).toBe(DomainVisitStatus.EXPIRED);
      expect(normalizeVisitStatus('COMPLETED')).toBe(DomainVisitStatus.COMPLETED);
      expect(normalizeVisitStatus('NO_SHOW')).toBe(DomainVisitStatus.NO_SHOW);
    });

    it('defaults undefined or null to REQUESTED', () => {
      expect(normalizeVisitStatus(undefined)).toBe(DomainVisitStatus.REQUESTED);
      expect(normalizeVisitStatus(null)).toBe(DomainVisitStatus.REQUESTED);
    });
  });

  describe('Valid Transitions & Role Guards', () => {
    // 1. From REQUESTED
    it('allows LANDLORD to confirm REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CONFIRMED, 'LANDLORD')).toBe(true);
      expect(() => VisitStateMachine.assertCanTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CONFIRMED, 'LANDLORD')).not.toThrow();
    });

    it('allows LANDLORD to decline REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.DECLINED, 'LANDLORD')).toBe(true);
    });

    it('allows LANDLORD to propose reschedule on REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.RESCHEDULE_PROPOSED, 'LANDLORD')).toBe(true);
    });

    it('allows TENANT to cancel REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CANCELLED, 'TENANT')).toBe(true);
    });

    it('allows SYSTEM to expire REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.EXPIRED, 'SYSTEM')).toBe(true);
    });

    // 2. From RESCHEDULE_PROPOSED
    it('allows TENANT to confirm rescheduled visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.RESCHEDULE_PROPOSED, DomainVisitStatus.CONFIRMED, 'TENANT')).toBe(true);
    });

    it('allows TENANT to decline rescheduled visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.RESCHEDULE_PROPOSED, DomainVisitStatus.DECLINED, 'TENANT')).toBe(true);
    });

    it('allows either party to cancel rescheduled visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.RESCHEDULE_PROPOSED, DomainVisitStatus.CANCELLED, 'TENANT')).toBe(true);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.RESCHEDULE_PROPOSED, DomainVisitStatus.CANCELLED, 'LANDLORD')).toBe(true);
    });

    // 3. From CONFIRMED
    it('allows LANDLORD and TENANT to complete CONFIRMED visit via OTP', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.COMPLETED, 'LANDLORD')).toBe(true);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.COMPLETED, 'TENANT')).toBe(true);
    });

    it('allows LANDLORD to report NO_SHOW on CONFIRMED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.NO_SHOW, 'LANDLORD')).toBe(true);
    });

    it('allows cancellation on CONFIRMED visit before cutoff', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.CANCELLED, 'TENANT')).toBe(true);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.CANCELLED, 'LANDLORD')).toBe(true);
    });

    it('allows ADMIN to perform any legal transition', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CONFIRMED, 'ADMIN')).toBe(true);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CANCELLED, 'ADMIN')).toBe(true);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.COMPLETED, 'ADMIN')).toBe(true);
    });
  });

  describe('Invalid Transitions & Unauthorized Roles', () => {
    it('rejects TENANT trying to confirm REQUESTED visit', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CONFIRMED, 'TENANT')).toBe(false);
      expect(() =>
        VisitStateMachine.assertCanTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CONFIRMED, 'TENANT'),
      ).toThrow(/not authorized/i);
    });

    it('rejects LANDLORD trying to cancel REQUESTED visit directly (must decline)', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.CANCELLED, 'LANDLORD')).toBe(false);
    });

    it('rejects transition from terminal states', () => {
      const terminalStatuses = [
        DomainVisitStatus.COMPLETED,
        DomainVisitStatus.CANCELLED,
        DomainVisitStatus.DECLINED,
        DomainVisitStatus.EXPIRED,
        DomainVisitStatus.NO_SHOW,
      ];

      for (const terminal of terminalStatuses) {
        expect(VisitStateMachine.isTerminal(terminal)).toBe(true);
        expect(VisitStateMachine.canTransition(terminal, DomainVisitStatus.CONFIRMED, 'LANDLORD')).toBe(false);
        expect(VisitStateMachine.canTransition(terminal, DomainVisitStatus.REQUESTED, 'TENANT')).toBe(false);
        expect(() =>
          VisitStateMachine.assertCanTransition(terminal, DomainVisitStatus.CONFIRMED, 'LANDLORD'),
        ).toThrow(/Illegal visit state transition/i);
      }
    });

    it('rejects self-transition (from === to)', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.REQUESTED, 'LANDLORD')).toBe(false);
      expect(VisitStateMachine.canTransition(DomainVisitStatus.CONFIRMED, DomainVisitStatus.CONFIRMED, 'LANDLORD')).toBe(false);
    });

    it('rejects skipping from REQUESTED directly to COMPLETED', () => {
      expect(VisitStateMachine.canTransition(DomainVisitStatus.REQUESTED, DomainVisitStatus.COMPLETED, 'LANDLORD')).toBe(false);
    });
  });

  describe('getAllowedTransitions helper', () => {
    it('returns correct allowed next statuses for LANDLORD on REQUESTED', () => {
      const allowed = VisitStateMachine.getAllowedTransitions(DomainVisitStatus.REQUESTED, 'LANDLORD');
      expect(allowed).toContain(DomainVisitStatus.CONFIRMED);
      expect(allowed).toContain(DomainVisitStatus.DECLINED);
      expect(allowed).toContain(DomainVisitStatus.RESCHEDULE_PROPOSED);
      expect(allowed).not.toContain(DomainVisitStatus.CANCELLED);
    });

    it('returns empty array for terminal state', () => {
      expect(VisitStateMachine.getAllowedTransitions(DomainVisitStatus.COMPLETED, 'LANDLORD')).toEqual([]);
    });
  });
});
