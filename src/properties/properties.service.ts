import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PropertyQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 12;
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      status: query.status ?? PropertyStatus.PUBLISHED,
    };

    if (query.area) {
      where.area = { contains: query.area.trim(), mode: 'insensitive' };
    }

    if (query.city) {
      where.city = { contains: query.city.trim(), mode: 'insensitive' };
    }

    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }

    if (query.bedrooms) {
      where.bedrooms = { gte: Number(query.bedrooms) };
    }

    if (query.bathrooms) {
      where.bathrooms = { gte: Number(query.bathrooms) };
    }

    if (query.minRent !== undefined || query.maxRent !== undefined) {
      where.rentAmount = {};
      if (query.minRent !== undefined) {
        where.rentAmount.gte = new Prisma.Decimal(query.minRent);
      }
      if (query.maxRent !== undefined) {
        where.rentAmount.lte = new Prisma.Decimal(query.maxRent);
      }
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { area: { contains: s, mode: 'insensitive' } },
        { addressLine: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.amenities && query.amenities.length > 0) {
      where.amenities = {
        some: {
          amenity: {
            OR: [
              { id: { in: query.amenities } },
              { slug: { in: query.amenities } },
            ],
          },
        },
      };
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder || 'desc';
    const orderBy: Prisma.PropertyOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };

    const [total, properties] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          photos: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          amenities: {
            include: {
              amenity: true,
            },
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
      }),
    ]);

    const formatted = properties.map((prop) => ({
      ...prop,
      amenities: prop.amenities.map((pa) => pa.amenity),
    }));

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, currentUserId?: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            landlordProfile: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Increment viewCount asynchronously
    await this.prisma.property
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    let isFavourited = false;
    if (currentUserId) {
      const fav = await this.prisma.favourite.findUnique({
        where: {
          tenantId_propertyId: {
            tenantId: currentUserId,
            propertyId: id,
          },
        },
      });
      isFavourited = !!fav;
    }

    return {
      ...property,
      amenities: property.amenities.map((pa) => pa.amenity),
      isFavourited,
    };
  }

  async create(landlordId: string, dto: CreatePropertyDto) {
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          landlordId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          propertyType: dto.propertyType,
          rentAmount: new Prisma.Decimal(dto.rentAmount),
          depositAmount: dto.depositAmount !== undefined ? new Prisma.Decimal(dto.depositAmount) : null,
          bedrooms: dto.bedrooms,
          bathrooms: dto.bathrooms,
          areaSqft: dto.areaSqft,
          floor: dto.floor,
          totalFloors: dto.totalFloors,
          addressLine: dto.addressLine.trim(),
          area: dto.area.trim(),
          city: dto.city?.trim() || 'Dhaka',
          district: dto.district?.trim() || 'Dhaka',
          availableFrom: dto.availableFrom,
          status: dto.status ?? PropertyStatus.DRAFT,
          photos: dto.photos && dto.photos.length > 0
            ? {
                create: dto.photos.map((p, index) => ({
                  url: p.url,
                  caption: p.caption,
                  isPrimary: p.isPrimary ?? index === 0,
                  sortOrder: p.sortOrder ?? index,
                })),
              }
            : undefined,
          amenities: dto.amenityIds && dto.amenityIds.length > 0
            ? {
                create: dto.amenityIds.map((amenityId) => ({
                  amenityId,
                })),
              }
            : undefined,
        },
        include: {
          photos: true,
          amenities: {
            include: { amenity: true },
          },
        },
      });

      return {
        ...property,
        amenities: property.amenities.map((pa) => pa.amenity),
      };
    });
  }

  async update(id: string, userId: string, roles: string[], dto: UpdatePropertyDto) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { photos: true, amenities: true },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const isAdmin = roles.includes(Role.ADMIN);
    if (!isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this property');
    }

    return this.prisma.$transaction(async (tx) => {
      // If new amenities provided, replace existing relations
      if (dto.amenityIds !== undefined) {
        await tx.propertyAmenity.deleteMany({
          where: { propertyId: id },
        });

        if (dto.amenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: dto.amenityIds.map((amenityId) => ({
              propertyId: id,
              amenityId,
            })),
          });
        }
      }

      // If new photos provided, replace existing
      if (dto.photos !== undefined) {
        await tx.propertyPhoto.deleteMany({
          where: { propertyId: id },
        });

        if (dto.photos.length > 0) {
          await tx.propertyPhoto.createMany({
            data: dto.photos.map((p, idx) => ({
              propertyId: id,
              url: p.url,
              caption: p.caption,
              isPrimary: p.isPrimary ?? idx === 0,
              sortOrder: p.sortOrder ?? idx,
            })),
          });
        }
      }

      const updated = await tx.property.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.description !== undefined && { description: dto.description.trim() }),
          ...(dto.propertyType !== undefined && { propertyType: dto.propertyType }),
          ...(dto.rentAmount !== undefined && { rentAmount: new Prisma.Decimal(dto.rentAmount) }),
          ...(dto.depositAmount !== undefined && {
            depositAmount: dto.depositAmount !== null ? new Prisma.Decimal(dto.depositAmount) : null,
          }),
          ...(dto.bedrooms !== undefined && { bedrooms: dto.bedrooms }),
          ...(dto.bathrooms !== undefined && { bathrooms: dto.bathrooms }),
          ...(dto.areaSqft !== undefined && { areaSqft: dto.areaSqft }),
          ...(dto.floor !== undefined && { floor: dto.floor }),
          ...(dto.totalFloors !== undefined && { totalFloors: dto.totalFloors }),
          ...(dto.addressLine !== undefined && { addressLine: dto.addressLine.trim() }),
          ...(dto.area !== undefined && { area: dto.area.trim() }),
          ...(dto.city !== undefined && { city: dto.city.trim() }),
          ...(dto.district !== undefined && { district: dto.district.trim() }),
          ...(dto.availableFrom !== undefined && { availableFrom: dto.availableFrom }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: {
          photos: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          amenities: {
            include: { amenity: true },
          },
        },
      });

      return {
        ...updated,
        amenities: updated.amenities.map((pa) => pa.amenity),
      };
    });
  }

  async changeStatus(id: string, userId: string, roles: string[], newStatus: PropertyStatus) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const isAdmin = roles.includes(Role.ADMIN);
    if (!isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('You do not have permission to change this property status');
    }

    return this.prisma.property.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async findLandlordProperties(landlordId: string, status?: PropertyStatus) {
    const properties = await this.prisma.property.findMany({
      where: {
        landlordId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        photos: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        amenities: {
          include: { amenity: true },
        },
        _count: {
          select: {
            applications: true,
            visits: true,
            favourites: true,
          },
        },
      },
    });

    return properties.map((prop) => ({
      ...prop,
      amenities: prop.amenities.map((pa) => pa.amenity),
      applicationCount: prop._count.applications,
      visitCount: prop._count.visits,
      favouriteCount: prop._count.favourites,
    }));
  }

  async deleteProperty(id: string, userId: string, roles: string[]) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const isAdmin = roles.includes(Role.ADMIN);
    if (!isAdmin && property.landlordId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this property');
    }

    // If already in DRAFT and has no applications, hard delete; otherwise archive
    if (property.status === PropertyStatus.DRAFT) {
      return this.prisma.property.delete({
        where: { id },
      });
    }

    return this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.ARCHIVED },
    });
  }

  async getAmenities() {
    return this.prisma.amenity.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
