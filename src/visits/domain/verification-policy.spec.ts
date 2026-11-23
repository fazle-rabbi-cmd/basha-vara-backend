import { describe, it, expect } from 'vitest';
import { OtpHasher } from './otp-hasher.js';
import { VerificationPolicy } from './verification-policy.js';

describe('OtpHasher', () => {
  it('should generate a 6-digit numeric OTP', () => {
    const otp = OtpHasher.generateNumericOtp(6);
    expect(otp).toMatch(/^\d{6}$/);
    const num = parseInt(otp, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  });

  it('should generate a cryptographic salt', () => {
    const salt1 = OtpHasher.generateSalt();
    const salt2 = OtpHasher.generateSalt();
    expect(salt1).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(salt1).not.toBe(salt2);
  });

  it('should hash and verify OTP matching salt correctly', () => {
    const otp = '849201';
    const salt = OtpHasher.generateSalt();
    const hash = OtpHasher.hashOtp(otp, salt);

    expect(hash).toHaveLength(64); // SHA-256 hex is 64 chars
    expect(OtpHasher.verifyOtpHash(otp, salt, hash)).toBe(true);
    expect(OtpHasher.verifyOtpHash('000000', salt, hash)).toBe(false);
    expect(OtpHasher.verifyOtpHash(otp, 'differentsalt', hash)).toBe(false);
  });

  it('should return false for malformed or empty candidate OTPs', () => {
    const salt = OtpHasher.generateSalt();
    const hash = OtpHasher.hashOtp('123456', salt);

    expect(OtpHasher.verifyOtpHash('', salt, hash)).toBe(false);
    expect(OtpHasher.verifyOtpHash(null as any, salt, hash)).toBe(false);
    expect(OtpHasher.verifyOtpHash('123456', '', hash)).toBe(false);
    expect(OtpHasher.verifyOtpHash('123456', salt, '')).toBe(false);
  });
});

describe('VerificationPolicy', () => {
  const scheduledDate = '2028-12-01';
  const scheduledTime = '14:00'; // 2:00 PM (+06:00 Dhaka)

  describe('evaluateCheckInWindow', () => {
    // Visit starts at 14:00 (+06:00), window opens at 13:30 (-30m), window closes at 16:45 (14:45 + 2h)
    it('should reject check-in if earlier than 30 minutes before visit start', () => {
      // 13:15 (+06:00) is 45 mins before visit start
      const tooEarly = new Date('2028-12-01T13:15:00+06:00');
      const result = VerificationPolicy.evaluateCheckInWindow(
        scheduledDate,
        scheduledTime,
        45,
        30,
        2,
        tooEarly,
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOO_EARLY');
    });

    it('should allow check-in inside the window (e.g. 15 minutes before visit)', () => {
      // 13:45 (+06:00) is 15 mins before visit start
      const allowedTime = new Date('2028-12-01T13:45:00+06:00');
      const result = VerificationPolicy.evaluateCheckInWindow(
        scheduledDate,
        scheduledTime,
        45,
        30,
        2,
        allowedTime,
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('OK');
    });

    it('should allow check-in during the visit and within 2 hours after visit end', () => {
      // 15:30 (+06:00) is 45 mins after visit end (14:45), well within 2h post-visit window
      const allowedTime = new Date('2028-12-01T15:30:00+06:00');
      const result = VerificationPolicy.evaluateCheckInWindow(
        scheduledDate,
        scheduledTime,
        45,
        30,
        2,
        allowedTime,
      );

      expect(result.valid).toBe(true);
    });

    it('should reject check-in after window closes (> 2 hours after visit end)', () => {
      // 17:00 (+06:00) is 2h 15m after visit end (14:45)
      const expiredTime = new Date('2028-12-01T17:00:00+06:00');
      const result = VerificationPolicy.evaluateCheckInWindow(
        scheduledDate,
        scheduledTime,
        45,
        30,
        2,
        expiredTime,
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });
  });

  describe('isLocked', () => {
    it('should return false when failed attempts are under max threshold', () => {
      expect(VerificationPolicy.isLocked(0, 5)).toBe(false);
      expect(VerificationPolicy.isLocked(4, 5)).toBe(false);
    });

    it('should return true when failed attempts reach or exceed max threshold', () => {
      expect(VerificationPolicy.isLocked(5, 5)).toBe(true);
      expect(VerificationPolicy.isLocked(6, 5)).toBe(true);
    });
  });

  describe('evaluateGpsSignal', () => {
    it('should return null when coordinates are not provided', () => {
      expect(VerificationPolicy.evaluateGpsSignal(undefined, undefined, 23.79, 90.41)).toBeNull();
    });

    it('should pass GPS within 500m soft threshold without flagging', () => {
      // Coordinates in Banani, Dhaka ~150 meters apart
      const lat1 = 23.7937;
      const lon1 = 90.4066;
      const lat2 = 23.7925;
      const lon2 = 90.4072;

      const result = VerificationPolicy.evaluateGpsSignal(lat1, lon1, lat2, lon2, 500);
      expect(result).not.toBeNull();
      expect(result!.withinSoftThreshold).toBe(true);
      expect(result!.flaggedForReview).toBe(false);
      expect(result!.distanceMeters).toBeLessThan(500);
    });

    it('should flag GPS discrepancy when distance exceeds soft threshold (e.g. 5km away)', () => {
      // Gulshan vs Mirpur (~7km apart)
      const lat1 = 23.7925;
      const lon1 = 90.4078;
      const lat2 = 23.8223;
      const lon2 = 90.3654;

      const result = VerificationPolicy.evaluateGpsSignal(lat1, lon1, lat2, lon2, 500);
      expect(result).not.toBeNull();
      expect(result!.withinSoftThreshold).toBe(false);
      expect(result!.flaggedForReview).toBe(true);
      expect(result!.distanceMeters).toBeGreaterThan(3000);
    });
  });

  describe('isVerifiedVisitorActive', () => {
    it('should return true for visits verified within the last 14 days', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      expect(VerificationPolicy.isVerifiedVisitorActive(fiveDaysAgo, 14)).toBe(true);
    });

    it('should return false for visits verified more than 14 days ago', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      expect(VerificationPolicy.isVerifiedVisitorActive(fifteenDaysAgo, 14)).toBe(false);
    });

    it('should return false for unverified visits (null/undefined)', () => {
      expect(VerificationPolicy.isVerifiedVisitorActive(null)).toBe(false);
      expect(VerificationPolicy.isVerifiedVisitorActive(undefined)).toBe(false);
    });
  });
});
