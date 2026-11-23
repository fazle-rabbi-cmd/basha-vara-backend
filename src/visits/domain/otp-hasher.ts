/**
 * Basha Vara - Secure OTP Generator & Constant-Time Hasher
 * Pure domain utility for generating 6-digit numeric OTPs and verifying salted hashes.
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

export class OtpHasher {
  /**
   * Generates a cryptographically random numeric OTP of the specified length (default 6 digits).
   */
  static generateNumericOtp(length: number = 6): string {
    const bytes = randomBytes(4);
    const num = bytes.readUInt32BE(0);
    const maxVal = Math.pow(10, length);
    const minVal = Math.pow(10, length - 1);
    const otpNum = minVal + (num % (maxVal - minVal));
    return otpNum.toString();
  }

  /**
   * Generates a random cryptographic salt (hex string).
   */
  static generateSalt(byteLength: number = 16): string {
    return randomBytes(byteLength).toString('hex');
  }

  /**
   * Hashes the plaintext OTP with a per-visit salt using HMAC SHA-256.
   */
  static hashOtp(otp: string, salt: string): string {
    const trimmed = otp.trim();
    return createHmac('sha256', salt).update(trimmed).digest('hex');
  }

  /**
   * Verifies a candidate OTP against the stored hash in constant time to prevent timing attacks.
   */
  static verifyOtpHash(candidateOtp: string, salt: string, expectedHash: string): boolean {
    if (!candidateOtp || !salt || !expectedHash) {
      return false;
    }
    const candidateHash = this.hashOtp(candidateOtp, salt);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(candidateBuffer, expectedBuffer);
  }
}
