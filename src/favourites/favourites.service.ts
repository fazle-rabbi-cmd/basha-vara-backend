import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FavouritesService {
  constructor(private prisma: PrismaService) {}

  async getMyFavourites(tenantId: string) {
    const favourites = await this.prisma.favourite.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          include: {
            photos: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            },
            amenities: {
              include: { amenity: true },
            },
            landlord: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                landlordProfile: true,
              },
            },
          },
        },
      },
    });

    return favourites.map((fav) => ({
      favouriteId: fav.id,
      savedAt: fav.createdAt,
      property: {
        ...fav.property,
        amenities: fav.property.amenities.map((pa) => pa.amenity),
        isFavourited: true,
      },
    }));
  }

  async addFavourite(tenantId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    const existing = await this.prisma.favourite.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId,
          propertyId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Property is already in your favourites');
    }

    return this.prisma.$transaction(async (tx) => {
      const fav = await tx.favourite.create({
        data: {
          tenantId,
          propertyId,
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: { favouriteCount: { increment: 1 } },
      });

      return {
        message: 'Property added to favourites',
        favourite: fav,
      };
    });
  }

  async removeFavourite(tenantId: string, propertyId: string) {
    const existing = await this.prisma.favourite.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId,
          propertyId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Property is not in your favourites');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.favourite.delete({
        where: {
          tenantId_propertyId: {
            tenantId,
            propertyId,
          },
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          favouriteCount: {
            decrement: 1,
          },
        },
      });

      return {
        message: 'Property removed from favourites',
      };
    });
  }
}
