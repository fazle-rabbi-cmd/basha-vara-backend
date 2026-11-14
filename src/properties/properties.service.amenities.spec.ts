import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PropertiesService - Amenities Tests', () => {
  let service: PropertiesService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      property: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      tenantProfile: {
        findUnique: vi.fn(),
      },
      amenity: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      propertyPhoto: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      propertyAmenity: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      favourite: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAmenities', () => {
    it('should return all amenities ordered by category and name', async () => {
      const mockAmenities = [
        {
          id: 'amenity-1',
          name: 'WiFi',
          slug: 'wifi',
          category: 'ESSENTIALS',
          isCustom: false,
          createdBy: null,
          usageCount: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'amenity-2',
          name: 'Gym',
          slug: 'gym',
          category: 'LIFESTYLE',
          isCustom: false,
          createdBy: null,
          usageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.amenity.findMany.mockResolvedValue(mockAmenities);

      const result = await service.getAmenities();

      expect(result).toEqual(mockAmenities);
      expect(prisma.amenity.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    });

    it('should return empty array when no amenities exist', async () => {
      prisma.amenity.findMany.mockResolvedValue([]);

      const result = await service.getAmenities();

      expect(result).toEqual([]);
    });
  });

  describe('createCustomAmenity', () => {
    it('should create custom amenity with generated slug', async () => {
      const mockAmenity = {
        id: 'amenity-1',
        name: 'Rooftop Garden',
        slug: 'rooftop-garden',
        category: 'LIFESTYLE',
        isCustom: true,
        createdBy: 'user-1',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.amenity.create.mockResolvedValue(mockAmenity);

      const result = await service.createCustomAmenity('user-1', {
        name: 'Rooftop Garden',
        category: 'LIFESTYLE',
      } as any);

      expect(result).toEqual(mockAmenity);
      expect(prisma.amenity.create).toHaveBeenCalledWith({
        data: {
          name: 'Rooftop Garden',
          slug: 'rooftop-garden',
          category: 'LIFESTYLE',
          isCustom: true,
          createdBy: 'user-1',
          usageCount: 0,
        },
      });
    });

    it('should handle special characters in amenity name', async () => {
      const mockAmenity = {
        id: 'amenity-1',
        name: 'Pet Friendly!',
        slug: 'pet-friendly',
        category: 'ESSENTIALS',
        isCustom: true,
        createdBy: 'user-1',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.amenity.create.mockResolvedValue(mockAmenity);

      const result = await service.createCustomAmenity('user-1', {
        name: 'Pet Friendly!',
        category: 'ESSENTIALS',
      } as any);

      expect(result.slug).toBe('pet-friendly');
    });

    it('should throw ConflictException for duplicate amenity', async () => {
      const { Prisma } = await import('@prisma/client');
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.19.3' }
      );

      prisma.amenity.create.mockRejectedValue(error);

      await expect(service.createCustomAmenity('user-1', {
        name: 'WiFi',
        category: 'ESSENTIALS',
      } as any)).rejects.toThrow('An amenity with this name already exists');
    });

    it('should throw error for non-unique constraint errors', async () => {
      const error = new Error('Database error');
      error.name = 'PrismaClientKnownRequestError';
      (error as any).code = 'P2000';

      prisma.amenity.create.mockRejectedValue(error);

      await expect(service.createCustomAmenity('user-1', {
        name: 'Test Amenity',
        category: 'ESSENTIALS',
      } as any)).rejects.toThrow('Database error');
    });
  });
});
