import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn(),
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
    it('should register a new tenant user successfully', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        role: Role.TENANT,
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: Role.TENANT }],
              tenantProfile: { id: 'tenant-1' },
              landlordProfile: null,
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: Role.TENANT }],
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
      expect(result.user.roles).toContain(Role.TENANT);
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

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should hash password before storing', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!',
        fullName: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
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
                roles: [{ role: Role.TENANT }],
                tenantProfile: { id: 'tenant-1' },
                landlordProfile: null,
              };
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: dto.email,
              fullName: dto.fullName,
              status: UserStatus.ACTIVE,
              roles: [{ role: Role.TENANT }],
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
        roles: [{ role: Role.TENANT }],
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
        roles: [{ role: Role.TENANT }],
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
        roles: [{ role: Role.TENANT }],
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
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
        roles: [{ role: Role.TENANT }],
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
