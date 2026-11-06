import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FavouritesService } from './favourites.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { vi } from 'vitest';

describe('FavouritesService', () => {
  let service: FavouritesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    favourite: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavouritesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FavouritesService>(FavouritesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyFavourites', () => {
    it('should return all favourites for tenant', async () => {
      const tenantId = 'tenant-1';
      mockPrismaService.favourite.findMany.mockResolvedValue([
        {
          id: 'fav-1',
          tenantId,
          property: {
            id: 'prop-1',
            title: 'Test Property',
            amenities: [{ amenity: { id: 'amenity-1', name: 'WiFi' } }],
            photos: [],
            landlord: { id: 'landlord-1', fullName: 'Landlord', avatarUrl: null, landlordProfile: null },
          },
        },
      ]);

      const result = await service.getMyFavourites(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('favouriteId', 'fav-1');
      expect(result[0].property.isFavourited).toBe(true);
    });
  });

  describe('addFavourite', () => {
    it('should add property to favourites', async () => {
      const tenantId = 'tenant-1';
      const propertyId = 'prop-1';

      mockPrismaService.property.findUnique.mockResolvedValue({ id: propertyId });
      mockPrismaService.favourite.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.favourite.create.mockResolvedValue({ id: 'fav-1', tenantId, propertyId });

      const result = await service.addFavourite(tenantId, propertyId);

      expect(result).toHaveProperty('message', 'Property added to favourites');
      expect(mockPrismaService.favourite.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent property', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(service.addFavourite('tenant-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already favourited', async () => {
      const tenantId = 'tenant-1';
      const propertyId = 'prop-1';

      mockPrismaService.property.findUnique.mockResolvedValue({ id: propertyId });
      mockPrismaService.favourite.findUnique.mockResolvedValue({ id: 'fav-1' });

      await expect(service.addFavourite(tenantId, propertyId)).rejects.toThrow(ConflictException);
    });

    it('should increment favourite count on property', async () => {
      const tenantId = 'tenant-1';
      const propertyId = 'prop-1';

      mockPrismaService.property.findUnique.mockResolvedValue({ id: propertyId });
      mockPrismaService.favourite.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.favourite.create.mockResolvedValue({ id: 'fav-1' });

      await service.addFavourite(tenantId, propertyId);

      expect(mockPrismaService.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { favouriteCount: { increment: 1 } },
        }),
      );
    });
  });

  describe('removeFavourite', () => {
    it('should remove property from favourites', async () => {
      const tenantId = 'tenant-1';
      const propertyId = 'prop-1';

      mockPrismaService.favourite.findUnique.mockResolvedValue({ id: 'fav-1' });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      const result = await service.removeFavourite(tenantId, propertyId);

      expect(result).toHaveProperty('message', 'Property removed from favourites');
      expect(mockPrismaService.favourite.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if not favourited', async () => {
      mockPrismaService.favourite.findUnique.mockResolvedValue(null);

      await expect(service.removeFavourite('tenant-1', 'prop-1')).rejects.toThrow(NotFoundException);
    });

    it('should decrement favourite count on property', async () => {
      const tenantId = 'tenant-1';
      const propertyId = 'prop-1';

      mockPrismaService.favourite.findUnique.mockResolvedValue({ id: 'fav-1' });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      await service.removeFavourite(tenantId, propertyId);

      expect(mockPrismaService.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { favouriteCount: { decrement: 1 } },
        }),
      );
    });
  });
});
