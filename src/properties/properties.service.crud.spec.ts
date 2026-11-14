import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PropertiesService - CRUD Tests', () => {
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

  describe('findById', () => {
    it('should return property by id', async () => {
      const mockProperty = {
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
          email: 'landlord@test.com',
          phone: '01712345678',
          avatarUrl: null,
          landlordProfile: null,
        },
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue({ ...mockProperty, viewCount: 1 });
      prisma.favourite.findUnique.mockResolvedValue(null);

      const result = await service.findById('prop-1', 'user-1');

      expect(result).toEqual({
        ...mockProperty,
        amenities: [],
        isFavourited: false,
      });
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: { viewCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.findById('prop-1', 'user-1'))
        .rejects.toThrow('Property with ID prop-1 not found');
    });

    it('should check favourite status for authenticated user', async () => {
      const mockProperty = {
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
          email: 'landlord@test.com',
          phone: '01712345678',
          avatarUrl: null,
          landlordProfile: null,
        },
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue({ ...mockProperty, viewCount: 1 });
      prisma.favourite.findUnique.mockResolvedValue({ id: 'fav-1' });

      const result = await service.findById('prop-1', 'user-1');

      expect(result.isFavourited).toBe(true);
    });
  });

  describe('create', () => {
    it('should create property with photos and amenities', async () => {
      const mockProperty = {
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
        status: 'DRAFT',
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        landlordId: 'landlord-1',
        photos: [],
        amenities: [],
      };

      prisma.property.create.mockResolvedValue(mockProperty);

      const result = await service.create('landlord-1', {
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
        photos: [],
        amenityIds: [],
      } as any);

      expect(result).toEqual({
        ...mockProperty,
        amenities: [],
      });
    });
  });

  describe('update', () => {
    it('should update property as landlord', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Old Title',
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        title: 'New Title',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        title: 'New Title',
      } as any);

      expect(result).toEqual(updatedProperty);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Old Title',
        photos: [],
        amenities: [],
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);

      await expect(service.update('prop-1', 'other-user', ['TENANT'], {
        title: 'New Title',
      } as any)).rejects.toThrow('You do not have permission to modify this property');
    });

    it('should allow admin to update any property', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Old Title',
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        title: 'New Title',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.update('prop-1', 'admin-1', ['ADMIN'], {
        title: 'New Title',
      } as any);

      expect(result).toEqual(updatedProperty);
    });
  });

  describe('deleteProperty', () => {
    it('should delete property as landlord', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'DRAFT',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.delete.mockResolvedValue(mockProperty);

      const result = await service.deleteProperty('prop-1', 'landlord-1', ['LANDLORD']);

      expect(result).toEqual(mockProperty);
      expect(prisma.property.delete).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
      });
    });

    it('should archive property if not draft', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'PUBLISHED',
      };

      const archivedProperty = {
        ...mockProperty,
        status: 'ARCHIVED',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(archivedProperty);

      const result = await service.deleteProperty('prop-1', 'landlord-1', ['LANDLORD']);

      expect(result).toEqual(archivedProperty);
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: { status: 'ARCHIVED' },
      });
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.deleteProperty('prop-1', 'user-1', ['TENANT']))
        .rejects.toThrow('Property with ID prop-1 not found');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'DRAFT',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);

      await expect(service.deleteProperty('prop-1', 'other-user', ['TENANT']))
        .rejects.toThrow('You do not have permission to delete this property');
    });
  });

  describe('changeStatus', () => {
    it('should change property status as landlord', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'DRAFT',
      };

      const updatedProperty = {
        ...mockProperty,
        status: 'PUBLISHED',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.changeStatus('prop-1', 'landlord-1', ['LANDLORD'], 'PUBLISHED' as any);

      expect(result).toEqual(updatedProperty);
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: { status: 'PUBLISHED' },
      });
    });

    it('should allow admin to change any property status', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'DRAFT',
      };

      const updatedProperty = {
        ...mockProperty,
        status: 'ARCHIVED',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.changeStatus('prop-1', 'admin-1', ['ADMIN'], 'ARCHIVED' as any);

      expect(result).toEqual(updatedProperty);
    });

    it('should throw NotFoundException for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.changeStatus('prop-1', 'user-1', ['TENANT'], 'PUBLISHED' as any))
        .rejects.toThrow('Property with ID prop-1 not found');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        status: 'DRAFT',
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);

      await expect(service.changeStatus('prop-1', 'other-user', ['TENANT'], 'PUBLISHED' as any))
        .rejects.toThrow('You do not have permission to change this property status');
    });
  });

  describe('findLandlordProperties', () => {
    it('should return landlord properties with counts', async () => {
      const mockProperties = [
        {
          id: 'prop-1',
          title: 'Test Property 1',
          status: 'PUBLISHED',
          landlordId: 'landlord-1',
          photos: [],
          amenities: [],
          _count: {
            applications: 2,
            visits: 5,
            favourites: 3,
          },
        },
        {
          id: 'prop-2',
          title: 'Test Property 2',
          status: 'DRAFT',
          landlordId: 'landlord-1',
          photos: [],
          amenities: [],
          _count: {
            applications: 0,
            visits: 1,
            favourites: 0,
          },
        },
      ];

      prisma.property.findMany.mockResolvedValue(mockProperties);

      const result = await service.findLandlordProperties('landlord-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('applicationCount', 2);
      expect(result[0]).toHaveProperty('visitCount', 5);
      expect(result[0]).toHaveProperty('favouriteCount', 3);
      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: { landlordId: 'landlord-1' },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by status', async () => {
      const mockProperties = [
        {
          id: 'prop-1',
          title: 'Test Property',
          status: 'PUBLISHED',
          landlordId: 'landlord-1',
          photos: [],
          amenities: [],
          _count: {
            applications: 0,
            visits: 0,
            favourites: 0,
          },
        },
      ];

      prisma.property.findMany.mockResolvedValue(mockProperties);

      const result = await service.findLandlordProperties('landlord-1', 'PUBLISHED' as any);

      expect(result).toHaveLength(1);
      expect(prisma.property.findMany).toHaveBeenCalledWith({
        where: {
          landlordId: 'landlord-1',
          status: 'PUBLISHED',
        },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array when no properties exist', async () => {
      prisma.property.findMany.mockResolvedValue([]);

      const result = await service.findLandlordProperties('landlord-1');

      expect(result).toEqual([]);
    });
  });
});
