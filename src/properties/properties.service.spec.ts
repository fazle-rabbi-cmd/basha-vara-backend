import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PropertyStatus, Role } from '@prisma/client';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { vi } from 'vitest';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    property: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    favourite: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated properties', async () => {
      const query: PropertyQueryDto = { page: '1', limit: '10' };
      mockPrismaService.property.count.mockResolvedValue(20);
      mockPrismaService.property.findMany.mockResolvedValue([
        {
          id: 'prop-1',
          title: 'Test Property',
          amenities: [{ amenity: { id: 'amenity-1', name: 'WiFi' } }],
          photos: [],
          landlord: { id: 'landlord-1', fullName: 'Landlord', avatarUrl: null, landlordProfile: null },
        },
      ]);

      const result = await service.findAll(query);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 20);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('totalPages', 2);
    });

    it('should filter by property type', async () => {
      const query: PropertyQueryDto = { propertyType: 'APARTMENT' };
      mockPrismaService.property.count.mockResolvedValue(5);
      mockPrismaService.property.findMany.mockResolvedValue([]);

      await service.findAll(query);

      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            propertyType: 'APARTMENT',
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      const query: PropertyQueryDto = { minRent: '10000', maxRent: '20000' };
      mockPrismaService.property.count.mockResolvedValue(5);
      mockPrismaService.property.findMany.mockResolvedValue([]);

      await service.findAll(query);

      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rentAmount: expect.objectContaining({
              gte: expect.any(Object),
              lte: expect.any(Object),
            }),
          }),
        }),
      );
    });

    it('should require every selected amenity by slug without comparing against UUID columns', async () => {
      const query: PropertyQueryDto = { amenities: ['wifi-internet', 'parking'] };
      mockPrismaService.property.count.mockResolvedValue(0);
      mockPrismaService.property.findMany.mockResolvedValue([]);

      await service.findAll(query);

      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: PropertyStatus.PUBLISHED,
            AND: [
              { amenities: { some: { amenity: { slug: 'wifi-internet' } } } },
              { amenities: { some: { amenity: { slug: 'parking' } } } },
            ],
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return property with details', async () => {
      const propertyId = 'prop-1';
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        title: 'Test Property',
        amenities: [{ amenity: { id: 'amenity-1', name: 'WiFi' } }],
        photos: [],
        landlord: { id: 'landlord-1', fullName: 'Landlord', email: 'landlord@test.com', phone: null, avatarUrl: null, landlordProfile: null },
      });
      mockPrismaService.property.update.mockResolvedValue({});

      const result = await service.findById(propertyId);

      expect(result).toHaveProperty('id', propertyId);
      expect(mockPrismaService.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { viewCount: { increment: 1 } },
        }),
      );
    });

    it('should throw NotFoundException for non-existent property', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should check favourite status when userId provided', async () => {
      const propertyId = 'prop-1';
      const userId = 'user-1';
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        title: 'Test Property',
        amenities: [],
        photos: [],
        landlord: { id: 'landlord-1', fullName: 'Landlord', email: 'landlord@test.com', phone: null, avatarUrl: null, landlordProfile: null },
      });
      mockPrismaService.property.update.mockResolvedValue({});
      mockPrismaService.favourite = {
        findUnique: vi.fn().mockResolvedValue({ id: 'fav-1' }),
      };

      const result = await service.findById(propertyId, userId);

      expect(result.isFavourited).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new property', async () => {
      const dto: CreatePropertyDto = {
        title: 'New Property',
        description: 'Description',
        propertyType: 'APARTMENT',
        rentAmount: 15000,
        bedrooms: 2,
        bathrooms: 1,
        addressLine: '123 Street',
        area: 'Dhanmondi',
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.property.create.mockResolvedValue({
        id: 'prop-1',
        ...dto,
        amenities: [],
        photos: [],
      });

      const result = await service.create('landlord-1', dto);

      expect(result).toHaveProperty('id', 'prop-1');
      expect(mockPrismaService.property.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update property as landlord', async () => {
      const propertyId = 'prop-1';
      const userId = 'landlord-1';
      const dto: UpdatePropertyDto = { title: 'Updated Title' };

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: userId,
        photos: [],
        amenities: [],
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.property.update.mockResolvedValue({
        id: propertyId,
        title: dto.title,
        amenities: [],
        photos: [],
      });

      const result = await service.update(propertyId, userId, [Role.LANDLORD], dto);

      expect(result.title).toBe(dto.title);
    });

    it('should allow admin to update any property', async () => {
      const propertyId = 'prop-1';
      const userId = 'admin-1';
      const dto: UpdatePropertyDto = { title: 'Updated Title' };

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'other-landlord',
        photos: [],
        amenities: [],
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.property.update.mockResolvedValue({
        id: propertyId,
        title: dto.title,
        amenities: [],
        photos: [],
      });

      const result = await service.update(propertyId, userId, [Role.ADMIN], dto);

      expect(result.title).toBe(dto.title);
    });

    it('should throw ForbiddenException for non-owner non-admin', async () => {
      const propertyId = 'prop-1';
      const userId = 'user-1';
      const dto: UpdatePropertyDto = { title: 'Updated Title' };

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'other-landlord',
        photos: [],
        amenities: [],
      });

      await expect(service.update(propertyId, userId, [Role.TENANT], dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent property', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'user-1', [Role.LANDLORD], {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProperty', () => {
    it('should delete draft property', async () => {
      const propertyId = 'prop-1';
      const userId = 'landlord-1';

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: userId,
        status: PropertyStatus.DRAFT,
      });
      mockPrismaService.property.delete.mockResolvedValue({ id: propertyId });

      await service.deleteProperty(propertyId, userId, [Role.LANDLORD]);

      expect(mockPrismaService.property.delete).toHaveBeenCalledWith({ where: { id: propertyId } });
    });

    it('should archive published property instead of deleting', async () => {
      const propertyId = 'prop-1';
      const userId = 'landlord-1';

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: userId,
        status: PropertyStatus.PUBLISHED,
      });
      mockPrismaService.property.update.mockResolvedValue({ id: propertyId, status: PropertyStatus.ARCHIVED });

      await service.deleteProperty(propertyId, userId, [Role.LANDLORD]);

      expect(mockPrismaService.property.update).toHaveBeenCalledWith({
        where: { id: propertyId },
        data: { status: PropertyStatus.ARCHIVED },
      });
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        landlordId: 'other-landlord',
        status: PropertyStatus.DRAFT,
      });

      await expect(service.deleteProperty('prop-1', 'user-1', [Role.TENANT])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findLandlordProperties', () => {
    it('should return all properties for landlord', async () => {
      const landlordId = 'landlord-1';
      mockPrismaService.property.findMany.mockResolvedValue([
        {
          id: 'prop-1',
          amenities: [{ amenity: { id: 'amenity-1', name: 'WiFi' } }],
          photos: [],
          _count: { applications: 2, visits: 3, favourites: 5 },
        },
      ]);

      const result = await service.findLandlordProperties(landlordId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('applicationCount', 2);
      expect(result[0]).toHaveProperty('visitCount', 3);
      expect(result[0]).toHaveProperty('favouriteCount', 5);
    });

    it('should filter by status when provided', async () => {
      const landlordId = 'landlord-1';
      mockPrismaService.property.findMany.mockResolvedValue([]);

      await service.findLandlordProperties(landlordId, PropertyStatus.PUBLISHED);

      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            landlordId,
            status: PropertyStatus.PUBLISHED,
          }),
        }),
      );
    });
  });
});
