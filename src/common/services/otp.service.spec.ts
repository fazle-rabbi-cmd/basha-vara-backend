import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service.js';

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit OTP', () => {
      const otp = service.generateOtp('test-key');
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should store OTP with expiry time', () => {
      const otp = service.generateOtp('test-key');
      const expiryTime = service.getOtpExpiryTime('test-key');
      
      expect(expiryTime).toBeDefined();
      expect(expiryTime).toBeGreaterThan(Date.now());
      expect(expiryTime).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
    });

    it('should generate different OTPs for different keys', () => {
      const otp1 = service.generateOtp('key1');
      const otp2 = service.generateOtp('key2');
      
      expect(otp1).not.toBe(otp2);
    });
  });

  describe('verifyOtp', () => {
    it('should verify valid OTP', () => {
      const otp = service.generateOtp('test-key');
      const isValid = service.verifyOtp('test-key', otp);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid OTP', () => {
      const otp = service.generateOtp('test-key');
      const isValid = service.verifyOtp('test-key', '000000');
      
      expect(isValid).toBe(false);
    });

    it('should reject OTP for non-existent key', () => {
      const isValid = service.verifyOtp('non-existent-key', '123456');
      expect(isValid).toBe(false);
    });

    it('should delete OTP after successful verification', () => {
      const otp = service.generateOtp('test-key');
      service.verifyOtp('test-key', otp);
      
      // Try to verify again should fail
      const isValid = service.verifyOtp('test-key', otp);
      expect(isValid).toBe(false);
    });

    it('should handle expired OTPs', () => {
      const otp = service.generateOtp('test-key');
      
      // Manually expire the OTP by manipulating the store
      const stored = service['otpStore'].get('test-key');
      stored.expiresAt = Date.now() - 1000; // Expired 1 second ago
      
      const isValid = service.verifyOtp('test-key', otp);
      expect(isValid).toBe(false);
      
      // OTP should be deleted after expiry
      expect(service.getOtpExpiryTime('test-key')).toBeNull();
    });
  });

  describe('getOtpExpiryTime', () => {
    it('should return expiry time for existing OTP', () => {
      service.generateOtp('test-key');
      const expiryTime = service.getOtpExpiryTime('test-key');
      
      expect(expiryTime).toBeDefined();
      expect(typeof expiryTime).toBe('number');
    });

    it('should return null for non-existent OTP', () => {
      const expiryTime = service.getOtpExpiryTime('non-existent-key');
      expect(expiryTime).toBeNull();
    });
  });
});
