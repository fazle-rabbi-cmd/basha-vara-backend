/**
 * Basha Vara - Visit Verification Domain Policies
 * Pure functions encapsulating check-in time windows, lockout thresholds, GPS soft signals, and badge lifecycles.
 */

import { VisitPolicy } from './visit-policy.js';

export interface WindowCheckResult {
  valid: boolean;
  reason?: 'TOO_EARLY' | 'EXPIRED' | 'OK';
  message?: string;
  windowOpensAt: Date;
  windowClosesAt: Date;
}

export interface GpsCheckResult {
  distanceMeters: number;
  withinSoftThreshold: boolean;
  flaggedForReview: boolean;
}

export class VerificationPolicy {
  /**
   * Checks whether the current time falls inside the allowed visit check-in window.
   * Window: [Visit Start - windowBeforeMinutes] to [Visit End + windowAfterHours].
   */
  static evaluateCheckInWindow(
    scheduledDate: string | Date,
    scheduledTime: string,
    durationMinutes: number = 45,
    windowBeforeMinutes: number = 30,
    windowAfterHours: number = 2,
    now: Date = new Date(),
  ): WindowCheckResult {
    const visitStart = VisitPolicy.parseSlotDateTime(scheduledDate, scheduledTime);
    const visitEnd = new Date(visitStart.getTime() + durationMinutes * 60 * 1000);

    const windowOpensAt = new Date(visitStart.getTime() - windowBeforeMinutes * 60 * 1000);
    const windowClosesAt = new Date(visitEnd.getTime() + windowAfterHours * 60 * 60 * 1000);

    const nowMs = now.getTime();

    if (nowMs < windowOpensAt.getTime()) {
      return {
        valid: false,
        reason: 'TOO_EARLY',
        message: `Visit check-in opens ${windowBeforeMinutes} minutes before the scheduled time (${windowOpensAt.toISOString()}).`,
        windowOpensAt,
        windowClosesAt,
      };
    }

    if (nowMs > windowClosesAt.getTime()) {
      return {
        valid: false,
        reason: 'EXPIRED',
        message: `Visit check-in window has concluded. Check-in closed at ${windowClosesAt.toISOString()}.`,
        windowOpensAt,
        windowClosesAt,
      };
    }

    return {
      valid: true,
      reason: 'OK',
      windowOpensAt,
      windowClosesAt,
    };
  }

  /**
   * Evaluates if verification attempts have exceeded the maximum threshold and must be locked.
   */
  static isLocked(failedAttempts: number, maxAllowed: number = 5): boolean {
    return failedAttempts >= maxAllowed;
  }

  /**
   * Calculates geodesic distance in meters between two coordinates using the Haversine formula.
   */
  static calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Evaluates GPS check-in as a soft verification signal.
   * Note: Soft signal only - never hard-blocks the verification, but flags discrepancies for audit.
   */
  static evaluateGpsSignal(
    tenantLat?: number,
    tenantLon?: number,
    propertyLat?: number,
    propertyLon?: number,
    softThresholdMeters: number = 500,
  ): GpsCheckResult | null {
    if (
      tenantLat === undefined ||
      tenantLon === undefined ||
      propertyLat === undefined ||
      propertyLon === undefined
    ) {
      return null;
    }

    const distanceMeters = this.calculateHaversineDistanceMeters(
      tenantLat,
      tenantLon,
      propertyLat,
      propertyLon,
    );

    const withinSoftThreshold = distanceMeters <= softThresholdMeters;

    return {
      distanceMeters,
      withinSoftThreshold,
      flaggedForReview: !withinSoftThreshold,
    };
  }

  /**
   * Evaluates whether a "Verified Visitor" badge remains valid or has expired (default: 14 days).
   */
  static isVerifiedVisitorActive(
    verifiedAt: Date | string | null | undefined,
    expiryDays: number = 14,
    now: Date = new Date(),
  ): boolean {
    if (!verifiedAt) return false;
    const verifiedTime = verifiedAt instanceof Date ? verifiedAt.getTime() : new Date(verifiedAt).getTime();
    if (isNaN(verifiedTime)) return false;

    const expiryTime = verifiedTime + expiryDays * 24 * 60 * 60 * 1000;
    return now.getTime() < expiryTime;
  }
}
