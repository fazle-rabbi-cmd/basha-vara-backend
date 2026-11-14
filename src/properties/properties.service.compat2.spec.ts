import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PropertiesService } from './properties.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const makeTenant = (overrides: Record<string, any> = {}) => ({
  userId: 'tenant-1',
  occupation: 'Software Engineer',
  maritalStatus: 'SINGLE',
  householdSize: 1,
  hasChildren: false,
  hasPets: false,
  smokingStatus: 'NON_SMOKER',
  returnTimePreference: '22:00',
  gender: 'MALE',
  ...overrides,
});

const makeProperty = (overrides: Record<string, any> = {}) => ({
  id: 'prop-1',
  title: 'Test Property',
  allowedOccupation: 'ANY',
  allowedMaritalStatus: 'ANY',
  allowedFamilyType: 'ANY',
  maxFamilySize: null,
  maxOccupancy: null,
  minChildrenAge: null,
  maxChildrenAge: null,
  allowInfants: true,
  allowToddlers: true,
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
  ...overrides,
});

describe('PropertiesService - Compatibility Branches', () => {
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
      amenity: { findMany: vi.fn(), create: vi.fn() },
      propertyPhoto: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      propertyAmenity: { create: vi.fn(), deleteMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  const runCompat = async (tenant: any, property: any) => {
    prisma.tenantProfile.findUnique.mockResolvedValue(tenant);
    prisma.property.count.mockResolvedValue(1);
    prisma.property.findMany.mockResolvedValue([property]);
    return service.findCompatibleProperties('tenant-1', {} as any);
  };

  it('should filter by maxOccupancy when household exceeds it', async () => {
    const result = await runCompat(
      makeTenant({ householdSize: 5 }),
      makeProperty({ maxOccupancy: 4 }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should keep property when household within maxOccupancy', async () => {
    const result = await runCompat(
      makeTenant({ householdSize: 3 }),
      makeProperty({ maxOccupancy: 4 }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('should filter by maxChildrenAge when oldest child exceeds it', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 4,
        hasChildren: true,
        childrenCount: 2,
        youngestChildAge: 8,
        oldestChildAge: 15,
      }),
      makeProperty({ maxChildrenAge: 12 }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter infant when allowInfants is false', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 3,
        hasChildren: true,
        childrenCount: 1,
        youngestChildAge: 1,
        oldestChildAge: 1,
      }),
      makeProperty({ allowInfants: false }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter toddler when allowToddlers is false', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 4,
        hasChildren: true,
        childrenCount: 2,
        youngestChildAge: 3,
        oldestChildAge: 10,
      }),
      makeProperty({ allowToddlers: false }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter school-age child when allowSchoolAge is false', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 4,
        hasChildren: true,
        childrenCount: 2,
        youngestChildAge: 8,
        oldestChildAge: 14,
      }),
      makeProperty({ allowSchoolAge: false, allowTeens: true }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter teen when allowTeens is false', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 4,
        hasChildren: true,
        childrenCount: 2,
        youngestChildAge: 15,
        oldestChildAge: 16,
      }),
      makeProperty({ allowTeens: false }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should keep property when all child age categories allowed', async () => {
    const result = await runCompat(
      makeTenant({
        maritalStatus: 'MARRIED',
        householdSize: 5,
        hasChildren: true,
        childrenCount: 3,
        youngestChildAge: 1,
        oldestChildAge: 15,
      }),
      makeProperty({ allowInfants: true, allowToddlers: true, allowSchoolAge: true, allowTeens: true }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('should filter WORKING-only property for student tenant', async () => {
    const result = await runCompat(
      makeTenant({ occupation: 'University Student' }),
      makeProperty({ allowedOccupation: 'WORKING' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter STUDENT-only property for working tenant', async () => {
    const result = await runCompat(
      makeTenant({ occupation: 'Software Engineer' }),
      makeProperty({ allowedOccupation: 'STUDENT' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should keep property when occupation matches', async () => {
    const result = await runCompat(
      makeTenant({ occupation: 'College Student' }),
      makeProperty({ allowedOccupation: 'STUDENT' }),
    );
    expect(result.data).toHaveLength(1);
  });

  it('should filter by marital status mismatch', async () => {
    const result = await runCompat(
      makeTenant({ maritalStatus: 'SINGLE' }),
      makeProperty({ allowedMaritalStatus: 'MARRIED' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter BACHELOR family type for married tenant', async () => {
    const result = await runCompat(
      makeTenant({ maritalStatus: 'MARRIED', householdSize: 3 }),
      makeProperty({ allowedFamilyType: 'BACHELOR' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter FAMILY family type for single tenant', async () => {
    const result = await runCompat(
      makeTenant({ maritalStatus: 'SINGLE', householdSize: 1 }),
      makeProperty({ allowedFamilyType: 'FAMILY' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should filter by minReturnTime when strict and tenant returns later', async () => {
    const result = await runCompat(
      makeTenant({ returnTimePreference: '23:30' }),
      makeProperty({ strictReturnTime: true, minReturnTime: '23:00' }),
    );
    expect(result.data).toHaveLength(0);
  });

  it('should keep property when tenant return time within limit', async () => {
    const result = await runCompat(
      makeTenant({ returnTimePreference: '22:00' }),
      makeProperty({ strictReturnTime: true, minReturnTime: '23:00' }),
    );
    expect(result.data).toHaveLength(1);
  });
});
