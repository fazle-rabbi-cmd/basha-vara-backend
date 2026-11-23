/**
 * Basha Vara - Visit Status Domain Enumeration
 * Canonical lifecycle statuses for property visits.
 */

export enum DomainVisitStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULE_PROPOSED = 'RESCHEDULE_PROPOSED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  LANDLORD_NO_SHOW = 'LANDLORD_NO_SHOW',
}

export type ActorRole = 'TENANT' | 'LANDLORD' | 'ADMIN' | 'SYSTEM';

/**
 * Normalizes any legacy or Prisma status string to canonical DomainVisitStatus.
 * Handles backward-compatibility (PENDING -> REQUESTED, ACCEPTED -> CONFIRMED).
 */
export function normalizeVisitStatus(rawStatus: string | null | undefined): DomainVisitStatus {
  if (!rawStatus) return DomainVisitStatus.REQUESTED;
  const upper = rawStatus.toUpperCase();

  switch (upper) {
    case 'PENDING':
    case 'REQUESTED':
      return DomainVisitStatus.REQUESTED;
    case 'ACCEPTED':
    case 'CONFIRMED':
      return DomainVisitStatus.CONFIRMED;
    case 'RESCHEDULE_PROPOSED':
      return DomainVisitStatus.RESCHEDULE_PROPOSED;
    case 'DECLINED':
      return DomainVisitStatus.DECLINED;
    case 'CANCELLED':
      return DomainVisitStatus.CANCELLED;
    case 'EXPIRED':
      return DomainVisitStatus.EXPIRED;
    case 'COMPLETED':
      return DomainVisitStatus.COMPLETED;
    case 'NO_SHOW':
      return DomainVisitStatus.NO_SHOW;
    case 'LANDLORD_NO_SHOW':
      return DomainVisitStatus.LANDLORD_NO_SHOW;
    default:
      return DomainVisitStatus.REQUESTED;
  }
}
