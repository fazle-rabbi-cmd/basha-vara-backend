import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthEmailQueueService } from '../email/auth-email-queue.service.js';
import { AuthActionTokenPurpose } from '@prisma/client';
import { createHash } from 'node:crypto';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { vi } from 'vitest';
import { AUTH_EMAIL_PURPOSE } from '../email/auth-email.types.js';

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

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    authActionToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

  describe('register', () => {
    it('should reject admin role through public registration', async () => {
      await expect(service.register({
        email: 'admin@example.com',
        password: 'Password123!',
        fullName: 'Unauthorized Admin',
        role: 'ADMIN',
      })).rejects.toThrow('Admin accounts cannot be created through public registration');
    });

    it('should register a new tenant user successfully', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        role: 'TENANT',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'TENANT' });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: { name: 'TENANT' } }],
              tenantProfile: { id: 'tenant-1' },
              landlordProfile: null,
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: { name: 'TENANT' } }],
              tenantProfile: { id: 'tenant-1' },
              landlordProfile: null,
            }),
          },
          tenantProfile: {
            create: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
          },
          landlordProfile: {
            create: vi.fn(),
          },
        };
        return callback(tx);
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(dto);

      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result.user).toHaveProperty('email', dto.email);
      expect(result.user.roles).toContain('TENANT');
    });

    it('should throw ConflictException if email already exists', async () => {
      const dto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        fullName: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if phone already exists', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        phone: '01712345678',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValueOnce({ id: 'existing' });

      const result = await service.register(dto).catch(e => e);
      console.log('Register result:', result);
      console.log('findUnique calls:', mockPrismaService.user.findUnique.mock.calls);
      console.log('findFirst calls:', mockPrismaService.user.findFirst.mock.calls);
      console.log('findFirst results:', mockPrismaService.user.findFirst.mock.results);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should hash password before storing', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'TENANT' });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: vi.fn().mockImplementation(async (data) => {
              const isHashed = await bcrypt.compare(dto.password, data.data.passwordHash);
              expect(isHashed).toBe(true);
              return {
                id: 'user-1',
                email: dto.email,
                fullName: dto.fullName,
                status: UserStatus.ACTIVE,
                roles: [{ role: { name: 'TENANT' } }],
                tenantProfile: { id: 'tenant-1' },
                landlordProfile: null,
              };
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: { name: 'TENANT' } }],
              tenantProfile: { id: 'tenant-1' },
              landlordProfile: null,
            }),
          },
          tenantProfile: {
            create: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
          },
          landlordProfile: {
            create: vi.fn(),
          },
        };
        return callback(tx);
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.register(dto);
    });
  });

  describe('login', () => {
    it('should require Google sign-in or password setup for passwordless users', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'google-user-1',
        email: 'google@example.com',
        passwordHash: null,
        status: UserStatus.ACTIVE,
        fullName: 'Google User',
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
      });

      await expect(service.login({
        email: 'google@example.com',
        password: 'AnyPassword123',
      })).rejects.toThrow('No password is set for this account');
    });

    it('should login successfully with valid credentials', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        fullName: 'Test User',
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result.user).toHaveProperty('email', dto.email);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      const dto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        roles: [{ role: { name: 'TENANT' } }],
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for suspended account', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        passwordHash: hashedPassword,
        status: UserStatus.SUSPENDED,
        roles: [{ role: { name: 'TENANT' } }],
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    it('should create a landlord profile when landlord is selected during Google signup', async () => {
      const email = 'landlord@example.com';
      const landlordProfile = { id: 'landlord-profile-1' };
      const createdUser = {
        id: 'google-landlord-1',
        email,
        fullName: 'Google Landlord',
        phone: null,
        avatarUrl: null,
        status: UserStatus.ACTIVE,
        roles: [{ role: { name: 'LANDLORD' } }],
        tenantProfile: null,
        landlordProfile,
      };
      const transaction = {
        user: {
          create: vi.fn().mockResolvedValue({ id: createdUser.id, fullName: createdUser.fullName }),
          findUnique: vi.fn().mockResolvedValue(createdUser),
        },
        tenantProfile: { create: vi.fn() },
        landlordProfile: { create: vi.fn().mockResolvedValue(landlordProfile) },
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'LANDLORD' });
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.googleLogin('google-id-token', 'LANDLORD');

      expect(transaction.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          roles: { create: [{ roleId: 'role-id' }] },
        }),
      }));
      expect(transaction.landlordProfile.create).toHaveBeenCalledWith({
        data: { userId: createdUser.id, businessName: createdUser.fullName },
      });
      expect(transaction.tenantProfile.create).not.toHaveBeenCalled();
      expect(result.user.roles).toContain('LANDLORD');
    });

    it('should create a passwordless user and queue an account-created email', async () => {
      const email = 'google@example.com';
      const createdUser = {
        id: 'google-user-1',
        email,
        fullName: 'Google User',
        phone: null,
        avatarUrl: null,
        status: UserStatus.ACTIVE,
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
      };
      const transaction = {
        user: {
          create: vi.fn().mockResolvedValue({ id: createdUser.id }),
          findUnique: vi.fn().mockResolvedValue(createdUser),
        },
        tenantProfile: { create: vi.fn() },
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'TENANT' });
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.googleLogin('google-id-token');

      expect(transaction.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          email,
          passwordHash: null,
        }),
      }));
      expect(mockAuthEmailQueue.queueEmail).toHaveBeenCalledWith(
        createdUser.id,
        AUTH_EMAIL_PURPOSE.GOOGLE_ACCOUNT_CREATED,
      );
      expect(result.user.email).toBe(email);
    });
  });

  describe('completePasswordSetup', () => {
    it('should set a password and consume the one-time token', async () => {
      const token = 'single-use-setup-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      mockPrismaService.authActionToken.findUnique.mockResolvedValue({
        id: 'action-token-1',
        userId: 'google-user-1',
        tokenHash,
        purpose: AuthActionTokenPurpose.PASSWORD_SETUP,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'google-user-1',
          status: UserStatus.ACTIVE,
          passwordHash: null,
        },
      });
      const transaction = {
        authActionToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        user: { update: vi.fn() },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      const result = await service.completePasswordSetup(token, 'ChosenPassword123!');
      const savedHash = transaction.user.update.mock.calls[0][0].data.passwordHash;

      expect(result.message).toContain('Password set successfully');
      expect(await bcrypt.compare('ChosenPassword123!', savedHash)).toBe(true);
      expect(transaction.authActionToken.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should reject unknown or expired tokens', async () => {
      mockPrismaService.authActionToken.findUnique.mockResolvedValue(null);

      await expect(service.completePasswordSetup('invalid-token', 'ChosenPassword123!'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should allow a passwordless Google user to set the first password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'google-user-1', passwordHash: null });
      const transaction = {
        user: { update: vi.fn() },
        authActionToken: { updateMany: vi.fn() },
      };
      mockPrismaService.$transaction.mockImplementation((callback) => callback(transaction));

      const result = await service.changePassword('google-user-1', undefined, 'ChosenPassword123!');
      const savedHash = transaction.user.update.mock.calls[0][0].data.passwordHash;

      expect(result.message).toContain('Password changed successfully');
      expect(await bcrypt.compare('ChosenPassword123!', savedHash)).toBe(true);
    });

    it('should require the current password after one has been set', async () => {
      const savedHash = await bcrypt.hash('CurrentPassword123!', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: savedHash });

      await expect(service.changePassword('user-1', undefined, 'NewPassword123!'))
        .rejects.toThrow('Current password is incorrect');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user data for valid userId', async () => {
      const userId = 'user-1';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        status: UserStatus.ACTIVE,
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
      });

      const result = await service.getCurrentUser(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });
});
