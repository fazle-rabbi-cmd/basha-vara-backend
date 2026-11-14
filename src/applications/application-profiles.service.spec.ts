import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApplicationProfilesService } from './application-profiles.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ApplicationProfilesService', () => {
  let service: ApplicationProfilesService;
  let prisma: any;

  const profile = {
    id: 'ap-1',
    userId: 'user-1',
    fullName: 'Tenant',
    phone: '017',
    email: 't@e.com',
    employmentStatus: 'EMPLOYED',
    monthlyIncome: 50000,
    hasPets: false,
    petDetails: null,
    emergencyContact: null,
    emergencyPhone: null,
    references: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      applicationProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationProfilesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApplicationProfilesService>(ApplicationProfilesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('findByUserId', () => {
    it('returns profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(profile);
      const result = await service.findByUserId('user-1');
      expect(result.id).toBe('ap-1');
    });

    it('throws NotFoundException for missing profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(null);
      await expect(service.findByUserId('u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      fullName: 'Tenant',
      phone: '017',
      email: 't@e.com',
      employmentStatus: 'EMPLOYED',
      monthlyIncome: 50000,
      hasPets: false,
    };

    it('creates profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(null);
      prisma.applicationProfile.create.mockResolvedValue(profile);

      const result = await service.create('user-1', dto as any);
      expect(result.id).toBe('ap-1');
      expect(prisma.applicationProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', hasPets: false }),
      });
    });

    it('rejects duplicate profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(profile);
      await expect(service.create('user-1', dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates provided fields only', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(profile);
      prisma.applicationProfile.update.mockResolvedValue({ ...profile, fullName: 'New' });

      const result = await service.update('user-1', { fullName: 'New' } as any);
      expect(result.fullName).toBe('New');
      expect(prisma.applicationProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { fullName: 'New' },
      });
    });

    it('converts monthlyIncome to Decimal', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(profile);
      prisma.applicationProfile.update.mockResolvedValue(profile);

      await service.update('user-1', { monthlyIncome: 60000 } as any);
      expect(prisma.applicationProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { monthlyIncome: expect.any(Object) },
      });
    });

    it('throws NotFoundException for missing profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(null);
      await expect(service.update('u', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(profile);
      prisma.applicationProfile.delete.mockResolvedValue({});

      await service.delete('user-1');
      expect(prisma.applicationProfile.delete).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('throws NotFoundException for missing profile', async () => {
      prisma.applicationProfile.findUnique.mockResolvedValue(null);
      await expect(service.delete('u')).rejects.toThrow(NotFoundException);
    });
  });
});
