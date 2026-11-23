/**
 * Basha Vara - Visit Domain Policies
 * Pure functions encapsulating business rules, time cutoffs, slot validations, and limits.
 */

import { ProposedSlot } from './visit.types.js';

export class VisitPolicy {
  /**
   * Combines date (YYYY-MM-DD) and time (HH:mm) into a UTC Date object.
   * Assumes Bangladesh Standard Time (UTC+6) representation when parsing.
   */
  static parseSlotDateTime(dateStr: string | Date, timeStr: string): Date {
    const d = dateStr instanceof Date ? dateStr.toISOString().split('T')[0] : dateStr.trim();
    // Parse HH:mm (or e.g. "10:00 AM", "02:30 PM")
    let hours = 0;
    let minutes = 0;

    const trimmed = timeStr.trim();
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match12) {
      hours = parseInt(match12[1], 10);
      minutes = parseInt(match12[2], 10);
      const ampm = match12[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
    }

    // Bangladesh is UTC+6 (offset -6 hours to get UTC)
    // Create standard ISO string with timezone +06:00
    const pad = (n: number) => n.toString().padStart(2, '0');
    const isoString = `${d}T${pad(hours)}:${pad(minutes)}:00+06:00`;
    return new Date(isoString);
  }

  /**
   * Checks if cancellation or reschedule is requested within the restricted cutoff window.
   * Returns true if within cutoff (BLOCKED), false if allowed.
   */
  static isBlockedByCutoff(
    scheduledDate: string | Date,
    scheduledTime: string,
    cutoffHours: number,
    now: Date = new Date(),
  ): boolean {
    const scheduledAt = this.parseSlotDateTime(scheduledDate, scheduledTime);
    const cutoffMs = cutoffHours * 60 * 60 * 1000;
    const diffMs = scheduledAt.getTime() - now.getTime();

    // If already past scheduled time or within cutoff window, it is blocked
    return diffMs <= cutoffMs;
  }

  /**
   * Checks whether two slots overlap given a duration in minutes.
   */
  static doSlotsOverlap(
    slotA: { date: string | Date; time: string },
    slotB: { date: string | Date; time: string },
    durationMinutes: number = 45,
  ): boolean {
    const startA = this.parseSlotDateTime(slotA.date, slotA.time).getTime();
    const endA = startA + durationMinutes * 60 * 1000;

    const startB = this.parseSlotDateTime(slotB.date, slotB.time).getTime();
    const endB = startB + durationMinutes * 60 * 1000;

    // Overlap condition: startA < endB && startB < endA
    return startA < endB && startB < endA;
  }

  /**
   * Validates candidate proposed slots from tenant (1 to 3 slots, future dates, valid format).
   */
  static validateProposedSlots(slots: ProposedSlot[], maxSlots: number = 3, now: Date = new Date()): void {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      throw new Error('Tenant must propose at least 1 candidate visit slot.');
    }

    if (slots.length > maxSlots) {
      throw new Error(`Tenant cannot propose more than ${maxSlots} candidate visit slots.`);
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.date || !slot.time) {
        throw new Error(`Proposed slot #${i + 1} must include both a valid date and time.`);
      }

      const slotDateTime = this.parseSlotDateTime(slot.date, slot.time);
      if (isNaN(slotDateTime.getTime())) {
        throw new Error(`Proposed slot #${i + 1} has an invalid date or time format.`);
      }

      if (slotDateTime.getTime() <= now.getTime()) {
        throw new Error(`Proposed slot #${i + 1} must be in the future.`);
      }
    }
  }

  /**
   * Checks if tenant has exceeded daily new visit request quota (max 5/day).
   */
  static isDailyQuotaExceeded(newRequestsTodayCount: number, maxDailyQuota: number = 5): boolean {
    return newRequestsTodayCount >= maxDailyQuota;
  }

  /**
   * Checks if tenant has active request on this property already.
   */
  static hasActiveRequestOnListing(activeCountOnListing: number, maxActive: number = 1): boolean {
    return activeCountOnListing >= maxActive;
  }
}
