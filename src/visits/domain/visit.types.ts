/**
 * Basha Vara - Visit Domain Interfaces and Value Objects
 */

import { ActorRole } from './visit-status.enum.js';

export interface ProposedSlot {
  date: string; // ISO format 'YYYY-MM-DD'
  time: string; // 24-hour 'HH:mm' or '10:00 AM'
  slotIndex?: number;
}

export interface ConfirmedSlot {
  date: string; // ISO format 'YYYY-MM-DD'
  time: string; // 'HH:mm'
}

export interface RescheduleProposal {
  date: string;
  time: string;
  proposedBy: ActorRole;
  reason?: string;
  proposedAt: string;
}

export enum VisitDeclineReasonCode {
  UNAVAILABLE = 'UNAVAILABLE',
  TENANT_REQUIREMENTS_UNMET = 'TENANT_REQUIREMENTS_UNMET',
  PRICE_FIRM = 'PRICE_FIRM',
  SCHEDULING_CONFLICT = 'SCHEDULING_CONFLICT',
  PROPERTY_MAINTENANCE = 'PROPERTY_MAINTENANCE',
  OTHER = 'OTHER',
}
