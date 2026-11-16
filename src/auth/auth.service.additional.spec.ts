import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthEmailQueueService } from '../email/auth-email-queue.service.js';
import { AuthActionTokenPurpose } from '@prisma/client';
import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { AUTH_ACTION_TOKEN_PURPOSE, AUTH_EMAIL_PURPOSE } from '../email/auth-email.types.js';

// Mock OAuth2Client
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function() {
    return {
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-id',
          email: 'google@example.com',
          email_verified: true,
          name: 'Google User',
          picture: 'https://example.com/avatar.jpg',
        }),
      }),
      generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?...'),
      getToken: vi.fn().mockResolvedValue({
        tokens: {
          id_token: 'mock-id-token',
        },
      }),
    };
  }),
}));

describe('AuthService - Additional Tests', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    authActionToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    tenantProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
    landlordProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const mockAuthEmailQueue = {
    queueEmail: vi.fn().mockResolvedValue(undefined),
    queuePasswordLink: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuthEmailQueueService,
          useValue: mockAuthEmailQueue,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requestPasswordLink', () => {
    it('should return generic message for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordLink('nonexistent@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mockAuthEmailQueue.queuePasswordLink).not.toHaveBeenCalled();
    });

    it('should return generic message for suspended user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
        status: UserStatus.SUSPENDED,
      });

      const result = await service.requestPasswordLink('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mockAuthEmailQueue.queuePasswordLink).not.toHaveBeenCalled();
    });

    it('should queue password reset for user with password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
        status: UserStatus.ACTIVE,
      });
      mockPrismaService.authActionToken.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordLink('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mockAuthEmailQueue.queuePasswordLink).toHaveBeenCalledWith(
        'user-1',
        AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET
      );
    });

    it('should queue password setup for passwordless user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: null,
        status: UserStatus.ACTIVE,
      });
      mockPrismaService.authActionToken.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordLink('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mockAuthEmailQueue.queuePasswordLink).toHaveBeenCalledWith(
        'user-1',
        AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP
      );
    });

    it('should not queue if recent token exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hash',
        status: UserStatus.ACTIVE,
      });
      mockPrismaService.authActionToken.findFirst.mockResolvedValue({ id: 'token-1' });

      const result = await service.requestPasswordLink('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mockAuthEmailQueue.queuePasswordLink).not.toHaveBeenCalled();
    });
  });

  describe('completePasswordSetup', () => {
    it('should set password for passwordless user', async () => {
      const token = 'setup-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_SETUP,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
          passwordHash: null,
        },
      });

      const transaction = {
        authActionToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          update: vi.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      const result = await service.completePasswordSetup(token, 'NewPassword123!');

      expect(result.message).toContain('Password set successfully');
      expect(transaction.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('should reject invalid token', async () => {
      mockPrismaService.authActionToken.findUnique.mockResolvedValue(null);

      await expect(service.completePasswordSetup('invalid-token', 'NewPassword123!'))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject expired token', async () => {
      const token = 'expired-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_SETUP,
        expiresAt: new Date(Date.now() - 60_000), // Expired
        usedAt: null,
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
          passwordHash: null,
        },
      });

      await expect(service.completePasswordSetup(token, 'NewPassword123!'))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject if password already set for setup purpose', async () => {
      const token = 'setup-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_SETUP,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
          passwordHash: 'existing-hash',
        },
      });

      await expect(service.completePasswordSetup(token, 'NewPassword123!'))
        .rejects.toThrow('A password is already set');
    });

    it('should reject when user account is not active', async () => {
      const token = 'setup-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'user-1',
          status: UserStatus.SUSPENDED,
          passwordHash: 'hash',
        },
      });

      await expect(service.completePasswordSetup(token, 'NewPassword123!'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should reject when token consumption races', async () => {
      const token = 'setup-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'user-1',
          status: UserStatus.ACTIVE,
          passwordHash: 'hash',
        },
      });

      const transaction = {
        authActionToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        user: { update: vi.fn() },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      await expect(service.completePasswordSetup(token, 'NewPassword123!'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      const currentPassword = 'CurrentPassword123!';
      const hashedPassword = await bcrypt.hash(currentPassword, 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedPassword,
      });

      const transaction = {
        user: {
          update: vi.fn(),
        },
        authActionToken: {
          updateMany: vi.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      const result = await service.changePassword('user-1', currentPassword, 'NewPassword123!');

      expect(result.message).toContain('Password changed successfully');
      expect(transaction.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('should reject incorrect current password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedPassword,
      });

      await expect(service.changePassword('user-1', 'WrongPassword', 'NewPassword123!'))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should allow passwordless user to set first password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: null,
      });

      const transaction = {
        user: {
          update: vi.fn(),
        },
        authActionToken: {
          updateMany: vi.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      const result = await service.changePassword('user-1', undefined, 'NewPassword123!');

      expect(result.message).toContain('Password changed successfully');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.changePassword('nonexistent', 'password', 'NewPassword123!'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getNativeGoogleAuthUrl', () => {
    it('should generate Google auth URL', () => {
      process.env.GOOGLE_NATIVE_REDIRECT_URI = 'http://localhost:3000/auth/native-google/callback';

      const result = service.getNativeGoogleAuthUrl('TENANT');

      expect(result).toBe('https://accounts.google.com/o/oauth2/auth?...');
    });

    it('should throw error if redirect URI not configured', () => {
      delete process.env.GOOGLE_NATIVE_REDIRECT_URI;

      expect(() => service.getNativeGoogleAuthUrl('TENANT'))
        .toThrow('Google native redirect URI is not configured');
    });
  });

  describe('completeNativeGoogleLogin', () => {
    it('should complete native Google login', async () => {
      const state = 'mock-state';
      mockJwtService.verify.mockReturnValue({
        purpose: 'google-native',
        redirectUri: 'http://localhost:3000/auth/native-google/callback',
        role: 'TENANT',
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'google@example.com',
        fullName: 'Google User',
        status: UserStatus.ACTIVE,
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.completeNativeGoogleLogin('code', state);

      expect(result).toHaveProperty('accessToken', 'jwt-token');
    });

    it('should reject invalid state', async () => {
      mockJwtService.verify.mockReturnValue({ purpose: 'invalid' });

      await expect(service.completeNativeGoogleLogin('code', 'invalid-state'))
        .rejects.toThrow('Invalid Google OAuth state');
    });

    it('should reject when Google returns no id_token', async () => {
      mockJwtService.verify.mockReturnValue({
        purpose: 'google-native',
        redirectUri: 'http://localhost:3000/auth/native-google/callback',
        role: 'TENANT',
      });

      (service as any).googleClient.getToken = vi.fn().mockResolvedValue({
        tokens: {},
      });

      await expect(service.completeNativeGoogleLogin('code', 'state'))
        .rejects.toThrow('Google did not return an ID token');
    });

    it('should wrap generic Google errors in UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({
        purpose: 'google-native',
        redirectUri: 'http://localhost:3000/auth/native-google/callback',
        role: 'TENANT',
      });

      (service as any).googleClient.getToken = vi.fn().mockRejectedValue(
        new Error('network failure'),
      );

      await expect(service.completeNativeGoogleLogin('code', 'state'))
        .rejects.toThrow('Google authentication failed');
    });
  });
});
