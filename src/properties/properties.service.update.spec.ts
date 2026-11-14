import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PropertiesService - Update & Create Tests', () => {
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
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      propertyAmenity: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
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

    it('should create property with photos', async () => {
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
        photos: [
          {
            id: 'photo-1',
            url: 'https://example.com/photo1.jpg',
            caption: 'Photo 1',
            isPrimary: true,
            sortOrder: 0,
          },
        ],
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
        photos: [
          {
            url: 'https://example.com/photo1.jpg',
            caption: 'Photo 1',
          },
        ],
        amenityIds: [],
      } as any);

      expect(result.photos).toHaveLength(1);
    });

    it('should create property with amenities', async () => {
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
        amenities: [
          {
            id: 'property-amenity-1',
            propertyId: 'prop-1',
            amenityId: 'amenity-1',
            amenity: {
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
          },
        ],
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
        amenityIds: ['amenity-1'],
      } as any);

      expect(result.amenities).toHaveLength(1);
      expect(result.amenities[0]).toBeDefined();
    });

    it('should use default values for optional fields', async () => {
      const mockProperty = {
        id: 'prop-1',
        title: 'Test Property',
        description: 'Test description',
        propertyType: 'APARTMENT',
        rentAmount: 25000,
        depositAmount: null,
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
        bedrooms: 2,
        bathrooms: 1,
        areaSqft: 1000,
        floor: 1,
        totalFloors: 5,
        addressLine: '123 Test St',
        area: 'Dhanmondi',
        lat: 23.7461,
        lng: 90.3742,
        availableFrom: new Date(),
      } as any);

      expect(result).toEqual({
        ...mockProperty,
        amenities: [],
      });
    });
  });

  describe('update', () => {
    it('should update property with all fields', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Old Title',
        description: 'Old description',
        propertyType: 'APARTMENT',
        rentAmount: 20000,
        depositAmount: 40000,
        bedrooms: 1,
        bathrooms: 1,
        areaSqft: 800,
        floor: 1,
        totalFloors: 5,
        addressLine: 'Old Address',
        area: 'Old Area',
        city: 'Dhaka',
        district: 'Dhaka',
        lat: 23.7461,
        lng: 90.3742,
        availableFrom: new Date(),
        status: 'DRAFT',
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        title: 'New Title',
        description: 'New description',
        rentAmount: 30000,
        depositAmount: 60000,
        bedrooms: 3,
        bathrooms: 2,
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        title: 'New Title',
        description: 'New description',
        rentAmount: 30000,
        depositAmount: 60000,
        bedrooms: 3,
        bathrooms: 2,
      } as any);

      expect(result).toEqual(updatedProperty);
    });

    it('should update property amenities', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        amenities: [
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
        ],
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);
      prisma.propertyAmenity.deleteMany.mockResolvedValue({ count: 0 });
      prisma.propertyAmenity.createMany.mockResolvedValue({ count: 1 });

      const result = await service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        amenityIds: ['amenity-1'],
      } as any);

      expect(result.amenities).toHaveLength(1);
      expect(prisma.propertyAmenity.deleteMany).toHaveBeenCalled();
      expect(prisma.propertyAmenity.createMany).toHaveBeenCalled();
    });

    it('should update property photos', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        photos: [
          {
            id: 'photo-1',
            url: 'https://example.com/photo1.jpg',
            caption: 'Photo 1',
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);
      prisma.propertyPhoto.deleteMany.mockResolvedValue({ count: 0 });
      prisma.propertyPhoto.createMany.mockResolvedValue({ count: 1 });

      const result = await service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        photos: [
          {
            url: 'https://example.com/photo1.jpg',
            caption: 'Photo 1',
          },
        ],
      } as any);

      expect(result.photos).toHaveLength(1);
    });

    it('should handle partial updates', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Old Title',
        description: 'Old description',
        propertyType: 'APARTMENT',
        rentAmount: 20000,
        depositAmount: 40000,
        bedrooms: 1,
        bathrooms: 1,
        areaSqft: 800,
        floor: 1,
        totalFloors: 5,
        addressLine: 'Old Address',
        area: 'Old Area',
        city: 'Dhaka',
        district: 'Dhaka',
        lat: 23.7461,
        lng: 90.3742,
        availableFrom: new Date(),
        status: 'DRAFT',
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      expect(result.title).toBe('New Title');
      expect(result.description).toBe('Old description'); // Unchanged
    });

    it('should update landlord preferences', async () => {
      const mockProperty = {
        id: 'prop-1',
        landlordId: 'landlord-1',
        title: 'Test Property',
        photos: [],
        amenities: [],
      };

      const updatedProperty = {
        ...mockProperty,
        allowedOccupation: 'WORKING',
        allowedMaritalStatus: 'MARRIED',
        maxFamilySize: 4,
        allowPets: true,
        allowSmoking: false,
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.update('prop-1', 'landlord-1', ['LANDLORD'], {
        allowedOccupation: 'WORKING',
        allowedMaritalStatus: 'MARRIED',
        maxFamilySize: 4,
        allowPets: true,
        allowSmoking: false,
      } as any);

      expect(result.allowedOccupation).toBe('WORKING');
      expect(result.allowedMaritalStatus).toBe('MARRIED');
      expect(result.maxFamilySize).toBe(4);
      expect(result.allowPets).toBe(true);
      expect(result.allowSmoking).toBe(false);
    });
  });
});
