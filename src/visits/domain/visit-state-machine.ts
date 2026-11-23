/**
 * Basha Vara - Visit Lifecycle State Machine
 * Pure domain state machine enforcing transition rules and actor role permissions.
 */

import { DomainVisitStatus, ActorRole, normalizeVisitStatus } from './visit-status.enum.js';
export type { ActorRole };

export interface TransitionRule {
  from: DomainVisitStatus;
  to: DomainVisitStatus;
  allowedRoles: ActorRole[];
  description: string;
}

export const VISIT_TRANSITIONS: TransitionRule[] = [
  // 1. From REQUESTED
  {
    from: DomainVisitStatus.REQUESTED,
    to: DomainVisitStatus.CONFIRMED,
    allowedRoles: ['LANDLORD', 'ADMIN'],
    description: 'Landlord accepts one of the proposed candidate slots',
  },
  {
    from: DomainVisitStatus.REQUESTED,
    to: DomainVisitStatus.DECLINED,
    allowedRoles: ['LANDLORD', 'ADMIN'],
    description: 'Landlord declines visit request with reason code',
  },
  {
    from: DomainVisitStatus.REQUESTED,
    to: DomainVisitStatus.RESCHEDULE_PROPOSED,
    allowedRoles: ['LANDLORD', 'ADMIN'],
    description: 'Landlord proposes an alternative date/time slot',
  },
  {
    from: DomainVisitStatus.REQUESTED,
    to: DomainVisitStatus.CANCELLED,
    allowedRoles: ['TENANT', 'ADMIN'],
    description: 'Tenant cancels their pending visit request',
  },
  {
    from: DomainVisitStatus.REQUESTED,
    to: DomainVisitStatus.EXPIRED,
    allowedRoles: ['SYSTEM', 'ADMIN'],
    description: 'System expires request after 48h without response',
  },

  // 2. From RESCHEDULE_PROPOSED
  {
    from: DomainVisitStatus.RESCHEDULE_PROPOSED,
    to: DomainVisitStatus.CONFIRMED,
    allowedRoles: ['TENANT', 'ADMIN'],
    description: 'Tenant accepts the rescheduled slot proposed by landlord',
  },
  {
    from: DomainVisitStatus.RESCHEDULE_PROPOSED,
    to: DomainVisitStatus.DECLINED,
    allowedRoles: ['TENANT', 'ADMIN'],
    description: 'Tenant declines the rescheduled slot',
  },
  {
    from: DomainVisitStatus.RESCHEDULE_PROPOSED,
    to: DomainVisitStatus.CANCELLED,
    allowedRoles: ['TENANT', 'LANDLORD', 'ADMIN'],
    description: 'Either party cancels during reschedule negotiation',
  },
  {
    from: DomainVisitStatus.RESCHEDULE_PROPOSED,
    to: DomainVisitStatus.EXPIRED,
    allowedRoles: ['SYSTEM', 'ADMIN'],
    description: 'Reschedule proposal expires after timeout',
  },

  // 3. From CONFIRMED
  {
    from: DomainVisitStatus.CONFIRMED,
    to: DomainVisitStatus.COMPLETED,
    allowedRoles: ['LANDLORD', 'TENANT', 'ADMIN'],
    description: 'Visit attendance verified via secure OTP check-in',
  },
  {
    from: DomainVisitStatus.CONFIRMED,
    to: DomainVisitStatus.CANCELLED,
    allowedRoles: ['TENANT', 'LANDLORD', 'ADMIN'],
    description: 'Visit cancelled prior to cutoff time',
  },
  {
    from: DomainVisitStatus.CONFIRMED,
    to: DomainVisitStatus.RESCHEDULE_PROPOSED,
    allowedRoles: ['TENANT', 'LANDLORD', 'ADMIN'],
    description: 'Either party requests reschedule before cutoff time',
  },
  {
    from: DomainVisitStatus.CONFIRMED,
    to: DomainVisitStatus.NO_SHOW,
    allowedRoles: ['LANDLORD', 'ADMIN'],
    description: 'Tenant failed to attend scheduled visit',
  },
  {
    from: DomainVisitStatus.CONFIRMED,
    to: DomainVisitStatus.LANDLORD_NO_SHOW,
    allowedRoles: ['TENANT', 'ADMIN'],
    description: 'Landlord failed to attend confirmed visit as reported by tenant',
  },
];

export class VisitStateMachine {
  /**
   * Pure guard checking whether a transition from -> to is permissible for a given actor role.
   */
  static canTransition(
    fromRaw: string | DomainVisitStatus,
    toRaw: string | DomainVisitStatus,
    actorRole: ActorRole,
  ): boolean {
    const from = normalizeVisitStatus(fromRaw);
    const to = normalizeVisitStatus(toRaw);

    // No self-transition unless already in that state
    if (from === to) return false;

    const matchedRule = VISIT_TRANSITIONS.find(
      (rule) => rule.from === from && rule.to === to,
    );

    if (!matchedRule) return false;

    return matchedRule.allowedRoles.includes(actorRole) || actorRole === 'ADMIN';
  }

  /**
   * Asserts valid transition; throws descriptive domain error if illegal.
   */
  static assertCanTransition(
    fromRaw: string | DomainVisitStatus,
    toRaw: string | DomainVisitStatus,
    actorRole: ActorRole,
  ): void {
    const from = normalizeVisitStatus(fromRaw);
    const to = normalizeVisitStatus(toRaw);

    const rule = VISIT_TRANSITIONS.find(
      (r) => r.from === from && r.to === to,
    );

    if (!rule) {
      throw new Error(
        `Illegal visit state transition from '${from}' to '${to}'. This transition is not permitted in the lifecycle.`,
      );
    }

    if (!rule.allowedRoles.includes(actorRole) && actorRole !== 'ADMIN') {
      throw new Error(
        `Actor role '${actorRole}' is not authorized to transition visit from '${from}' to '${to}'. Allowed roles: ${rule.allowedRoles.join(', ')}.`,
      );
    }
  }

  /**
   * Returns list of allowed next statuses for an entity given current status and actor role.
   */
  static getAllowedTransitions(
    currentStatusRaw: string | DomainVisitStatus,
    actorRole: ActorRole,
  ): DomainVisitStatus[] {
    const current = normalizeVisitStatus(currentStatusRaw);
    return VISIT_TRANSITIONS
      .filter((rule) => rule.from === current && (rule.allowedRoles.includes(actorRole) || actorRole === 'ADMIN'))
      .map((rule) => rule.to);
  }

  /**
   * Check if a status is terminal (cannot transition out).
   */
  static isTerminal(statusRaw: string | DomainVisitStatus): boolean {
    const status = normalizeVisitStatus(statusRaw);
    return !VISIT_TRANSITIONS.some((rule) => rule.from === status);
  }
}
