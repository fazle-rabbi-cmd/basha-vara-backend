import { Injectable } from '@nestjs/common';

@Injectable()
export class OtpService {
  private otpStore = new Map<string, { otp: string; expiresAt: number }>();
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 15;

  generateOtp(key: string): string {
    const otp = this.generateRandomOtp();
    const expiresAt = Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000;
    this.otpStore.set(key, { otp, expiresAt });
    return otp;
  }

  verifyOtp(key: string, providedOtp: string): boolean {
    const stored = this.otpStore.get(key);

    if (!stored) {
      return false;
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(key);
      return false;
    }

    const isValid = stored.otp === providedOtp;

    if (isValid) {
      this.otpStore.delete(key);
    }

    return isValid;
  }

  private generateRandomOtp(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  getOtpExpiryTime(key: string): number | null {
    const stored = this.otpStore.get(key);
    return stored ? stored.expiresAt : null;
  }
}
