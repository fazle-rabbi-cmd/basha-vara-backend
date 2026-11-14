import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PropertiesService - Search & Filter Tests', () => {
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

  describe('findAll', () => {
    it('should return paginated properties', async () => {
      const mockProperties = [
        {
          id: 'prop-1',
          title: 'Test Property',
          description: 'Test description',
          propertyType: 'APARTMENT',
          rentAmount: 25000,
          depositAmount: 50000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          lat: 23.7461,
          lng: 90.3742,
          availableFrom: new Date(),
          status: 'PUBLISHED',
          viewCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          photos: [],
          amenities: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(mockProperties);

      const result = await service.findAll({ page: 1, limit: 12 } as any);

      expect(result).toEqual({
        data: mockProperties,
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });
    });

    it('should filter by area', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ area: 'Dhanmondi' } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          area: { contains: 'Dhanmondi', mode: 'insensitive' },
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by city', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ city: 'Dhaka' } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          city: { contains: 'Dhaka', mode: 'insensitive' },
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by property type', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ propertyType: 'APARTMENT' } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          propertyType: 'APARTMENT',
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by bedrooms and bathrooms', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ bedrooms: 2, bathrooms: 1 } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          bedrooms: { gte: 2 },
          bathrooms: { gte: 1 },
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by rent range', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ minRent: 10000, maxRent: 50000 } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          rentAmount: {
            gte: expect.any(Object),
            lte: expect.any(Object),
          },
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should search by title, description, area, or address', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'test' } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
            { area: { contains: 'test', mode: 'insensitive' } },
            { addressLine: { contains: 'test', mode: 'insensitive' } },
          ],
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by amenities', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ amenities: ['wifi', 'gym'] } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              amenities: expect.objectContaining({
                some: expect.objectContaining({
                  amenity: { slug: 'wifi' },
                }),
              }),
            }),
            expect.objectContaining({
              amenities: expect.objectContaining({
                some: expect.objectContaining({
                  amenity: { slug: 'gym' },
                }),
              }),
            }),
          ]),
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should handle pagination correctly', async () => {
      prisma.property.count.mockResolvedValue(25);
      prisma.property.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 2, limit: 10 } as any);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should sort by different fields', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ sortBy: 'rentAmount', sortOrder: 'asc' } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 0,
        take: 12,
        orderBy: { rentAmount: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should filter by availableBy date', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      const availableBy = new Date('2025-01-01');
      await service.findAll({ availableBy } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          availableFrom: { lte: availableBy },
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by amenity UUID', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      await service.findAll({ amenities: [uuid] } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              amenities: expect.objectContaining({
                some: expect.objectContaining({
                  amenity: { id: uuid },
                }),
              }),
            }),
          ]),
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by minRent only', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ minRent: 15000 } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          rentAmount: expect.objectContaining({
            gte: expect.any(Object),
          }),
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by maxRent only', async () => {
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      await service.findAll({ maxRent: 30000 } as any);

      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          rentAmount: expect.objectContaining({
            lte: expect.any(Object),
          }),
        }),
        skip: 0,
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('validateCoordinatePair', () => {
    it('should validate coordinates in create', async () => {
      await expect(service.create('landlord-1', {
        title: 'Test',
        lat: 91, // Invalid latitude
        lng: 90.3742,
      } as any)).rejects.toThrow('Provide a valid latitude and longitude together');
    });

    it('should validate coordinates in update', async () => {
      prisma.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        landlordId: 'landlord-1',
        status: 'DRAFT',
      });

      await expect(service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        lat: 23.7461,
        // lng missing
      } as any)).rejects.toThrow('Provide a valid latitude and longitude together');
    });
  });
});
