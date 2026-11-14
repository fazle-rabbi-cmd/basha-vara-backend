import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PropertiesService - Compatibility Tests', () => {
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

  describe('findCompatibleProperties', () => {
    it('should return all properties when tenant has no profile', async () => {
      prisma.tenantProfile.findUnique.mockResolvedValue(null);
      prisma.property.count.mockResolvedValue(0);
      prisma.property.findMany.mockResolvedValue([]);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter properties by occupation compatibility', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Student Property',
          allowedOccupation: 'STUDENT',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Student property should be filtered out for working professional
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by marital status', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'MARRIED',
        householdSize: 3,
        hasChildren: true,
        childrenCount: 1,
        youngestChildAge: 5,
        oldestChildAge: 5,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Bachelor Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'SINGLE',
          allowedFamilyType: 'BACHELOR',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Bachelor property should be filtered out for married tenant
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by family size', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'MARRIED',
        householdSize: 6,
        hasChildren: true,
        childrenCount: 3,
        youngestChildAge: 2,
        oldestChildAge: 10,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Small Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: 4,
          maxOccupancy: 5,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to family size
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by children age restrictions', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'MARRIED',
        householdSize: 4,
        hasChildren: true,
        childrenCount: 2,
        youngestChildAge: 3,
        oldestChildAge: 8,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'No Toddlers Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: 5,
          maxOccupancy: 6,
          minChildrenAge: 5,
          allowInfants: false,
          allowToddlers: false,
          allowSchoolAge: true,
          allowTeens: true,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to children age restrictions
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by pets', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: true,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'No Pets Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: false,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to pets restriction
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by smoking status', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: false,
        smokingStatus: 'SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'No Smoking Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to smoking restriction
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by return time preference', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:30',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Strict Return Time Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: true,
          minReturnTime: '23:00',
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to return time restriction
      expect(result.data).toHaveLength(0);
    });

    it('should filter properties by gender preference', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'FEMALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Male Only Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'MALE',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be filtered out due to gender preference
      expect(result.data).toHaveLength(0);
    });

    it('should return compatible properties when all criteria match', async () => {
      const tenantProfile = {
        userId: 'tenant-1',
        occupation: 'Software Engineer',
        maritalStatus: 'SINGLE',
        householdSize: 1,
        hasChildren: false,
        hasPets: false,
        smokingStatus: 'NON_SMOKER',
        returnTimePreference: '23:00',
        gender: 'MALE',
      };

      const properties = [
        {
          id: 'prop-1',
          title: 'Compatible Property',
          allowedOccupation: 'ANY',
          allowedMaritalStatus: 'ANY',
          allowedFamilyType: 'ANY',
          maxFamilySize: null,
          maxOccupancy: null,
          allowPets: true,
          allowSmoking: false,
          strictReturnTime: false,
          minReturnTime: null,
          preferredGender: 'ANY',
          rentAmount: 20000,
          depositAmount: 40000,
          bedrooms: 2,
          bathrooms: 1,
          areaSqft: 1000,
          floor: 1,
          totalFloors: 5,
          addressLine: '123 Test St',
          area: 'Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: new Date(),
          status: 'PUBLISHED',
          lat: 23.7461,
          lng: 90.3742,
          createdAt: new Date(),
          updatedAt: new Date(),
          landlordId: 'landlord-1',
          description: 'Test property',
          propertyType: 'APARTMENT',
          amenities: [],
          photos: [],
          landlord: {
            id: 'landlord-1',
            fullName: 'Test Landlord',
            avatarUrl: null,
            landlordProfile: null,
          },
        },
      ];

      prisma.tenantProfile.findUnique.mockResolvedValue(tenantProfile);
      prisma.property.count.mockResolvedValue(1);
      prisma.property.findMany.mockResolvedValue(properties);

      const result = await service.findCompatibleProperties('tenant-1', {} as any);

      // Property should be included
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Compatible Property');
    });
  });

  describe('validateCoordinatePair', () => {
    it('should validate latitude and longitude pair', () => {
      // Valid coordinates
      expect(() => service['validateCoordinatePair'](23.7461, 90.3742)).not.toThrow();
      
      // Both undefined is valid
      expect(() => service['validateCoordinatePair'](undefined, undefined)).not.toThrow();
    });

    it('should throw error for invalid coordinate pair', () => {
      // Only lat provided
      expect(() => service['validateCoordinatePair'](23.7461, undefined)).toThrow();
      
      // Only lng provided
      expect(() => service['validateCoordinatePair'](undefined, 90.3742)).toThrow();
      
      // Invalid lat
      expect(() => service['validateCoordinatePair'](91, 90.3742)).toThrow();
      
      // Invalid lng
      expect(() => service['validateCoordinatePair'](23.7461, 181)).toThrow();
    });
  });
});
