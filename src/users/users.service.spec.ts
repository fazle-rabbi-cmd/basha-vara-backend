import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { vi } from 'vitest';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenantProfile: {
      upsert: vi.fn(),
    },
    landlordProfile: {
      upsert: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user data for valid userId', async () => {
      const userId = 'user-1';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '01712345678',
        avatarUrl: null,
        status: 'ACTIVE',
        emailVisibility: 'MASKED',
        phoneVisibility: 'MASKED',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
        roles: [{ role: { name: 'TENANT' } }],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getUserById(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result.email).toContain('@');
      expect(result.roles).toContain('TENANT');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const userId = 'user-1';
      const dto: UpdateUserDto = {
        fullName: 'Updated Name',
        phone: '01787654321',
      };

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: dto.fullName,
        phone: dto.phone,
        avatarUrl: null,
        status: 'ACTIVE',
        roles: [{ role: 'TENANT' }],
        tenantProfile: null,
        landlordProfile: null,
      });

      const result = await service.updateUser(userId, dto);

      expect(result.fullName).toBe(dto.fullName);
      expect(result.phone).toBe(dto.phone);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({
            fullName: dto.fullName.trim(),
            phone: dto.phone.trim(),
          }),
        }),
      );
    });

    it('should trim strings before updating', async () => {
      const userId = 'user-1';
      const dto: UpdateUserDto = {
        fullName: '  Updated Name  ',
        phone: '  01787654321  ',
      };

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: 'Updated Name',
        phone: '01787654321',
        avatarUrl: null,
        status: 'ACTIVE',
        roles: [{ role: 'TENANT' }],
        tenantProfile: null,
        landlordProfile: null,
      });

      await service.updateUser(userId, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: 'Updated Name',
            phone: '01787654321',
          }),
        }),
      );
    });
  });

  describe('updateTenantProfile', () => {
    it('should create tenant profile if not exists', async () => {
      const userId = 'user-1';
      const dto = {
        occupation: 'Engineer',
        householdSize: 2,
      };

      mockPrismaService.tenantProfile.upsert.mockResolvedValue({
        id: 'tenant-1',
        userId,
        occupation: dto.occupation,
        householdSize: dto.householdSize,
      });

      const result = await service.updateTenantProfile(userId, dto);

      expect(result).toHaveProperty('occupation', dto.occupation);
      expect(mockPrismaService.tenantProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          create: expect.objectContaining({
            userId,
            occupation: dto.occupation,
          }),
        }),
      );
    });

    it('should update existing tenant profile', async () => {
      const userId = 'user-1';
      const dto = {
        occupation: 'Doctor',
        householdSize: 3,
      };

      mockPrismaService.tenantProfile.upsert.mockResolvedValue({
        id: 'tenant-1',
        userId,
        occupation: dto.occupation,
        householdSize: dto.householdSize,
      });

      const result = await service.updateTenantProfile(userId, dto);

      expect(result.occupation).toBe(dto.occupation);
    });
  });

  describe('updateLandlordProfile', () => {
    it('should create landlord profile if not exists', async () => {
      const userId = 'user-1';
      const dto = {
        businessName: 'Test Properties',
        contactPreference: 'EMAIL',
      };

      mockPrismaService.landlordProfile.upsert.mockResolvedValue({
        id: 'landlord-1',
        userId,
        businessName: dto.businessName,
        contactPreference: dto.contactPreference,
      });

      const result = await service.updateLandlordProfile(userId, dto);

      expect(result).toHaveProperty('businessName', dto.businessName);
      expect(mockPrismaService.landlordProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          create: expect.objectContaining({
            userId,
            businessName: dto.businessName,
          }),
        }),
      );
    });

    it('should update existing landlord profile', async () => {
      const userId = 'user-1';
      const dto = {
        businessName: 'Updated Properties',
      };

      mockPrismaService.landlordProfile.upsert.mockResolvedValue({
        id: 'landlord-1',
        userId,
        businessName: dto.businessName,
      });

      const result = await service.updateLandlordProfile(userId, dto);

      expect(result.businessName).toBe(dto.businessName);
    });
  });
});
