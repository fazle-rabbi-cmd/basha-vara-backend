import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus, AmenityCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { CreateCustomAmenityDto } from './dto/create-custom-amenity.dto.js';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  private validateCoordinatePair(lat?: number, lng?: number) {
    if (lat === undefined && lng === undefined) return;
    if (
      lat === undefined || lng === undefined ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      throw new BadRequestException('Provide a valid latitude and longitude together.');
    }
  }

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

    if (query.availableBy) {
      where.availableFrom = { lte: query.availableBy };
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
      where.AND = query.amenities.map((amenity) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(amenity);
        return {
        amenities: {
          some: {
            amenity: isUuid ? { id: amenity } : { slug: amenity },
          },
        },
        };
      });
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

  async findCompatibleProperties(tenantId: string, query: PropertyQueryDto) {
    // Get tenant profile
    const tenantProfile = await this.prisma.tenantProfile.findUnique({
      where: { userId: tenantId },
    });

    if (!tenantProfile) {
      return this.findAll(query);
    }

    // Build base query
    const baseQuery = { ...query };

    // Get all properties
    const result = await this.findAll(baseQuery);

    // Filter by compatibility
    const compatibleProperties = result.data.filter((property) => {
      // Check allowedOccupation
      if (property.allowedOccupation && property.allowedOccupation !== 'ANY') {
        const tenantOccupation = tenantProfile.occupation?.toLowerCase() || '';
        const isStudent = tenantOccupation.includes('student') || tenantOccupation.includes('university') || tenantOccupation.includes('college');
        const isWorking = !isStudent && tenantOccupation.length > 0;

        if (property.allowedOccupation === 'STUDENT' && !isStudent) return false;
        if (property.allowedOccupation === 'WORKING' && !isWorking) return false;
      }

      // Check allowedMaritalStatus
      if (property.allowedMaritalStatus && property.allowedMaritalStatus !== 'ANY') {
        if (tenantProfile.maritalStatus !== property.allowedMaritalStatus) return false;
      }

      // Check allowedFamilyType
      if (property.allowedFamilyType && property.allowedFamilyType !== 'ANY') {
        const isFamily = tenantProfile.maritalStatus === 'MARRIED' || (tenantProfile.householdSize && tenantProfile.householdSize > 1);
        const isBachelor = !isFamily;

        if (property.allowedFamilyType === 'FAMILY' && !isFamily) return false;
        if (property.allowedFamilyType === 'BACHELOR' && !isBachelor) return false;
      }

      // Check maxFamilySize
      if (property.maxFamilySize && tenantProfile.householdSize && tenantProfile.householdSize > property.maxFamilySize) {
        return false;
      }

      // Check maxOccupancy (total people including children)
      if (property.maxOccupancy && tenantProfile.householdSize && tenantProfile.householdSize > property.maxOccupancy) {
        return false;
      }

      // Check children age restrictions
      if (tenantProfile.hasChildren && tenantProfile.childrenCount && tenantProfile.childrenCount > 0) {
        // Check minimum children age
        if (property.minChildrenAge !== null && property.minChildrenAge !== undefined && tenantProfile.youngestChildAge) {
          if (tenantProfile.youngestChildAge < property.minChildrenAge) {
            return false;
          }
        }

        // Check maximum children age
        if (property.maxChildrenAge !== null && property.maxChildrenAge !== undefined && tenantProfile.oldestChildAge) {
          if (tenantProfile.oldestChildAge > property.maxChildrenAge) {
            return false;
          }
        }

        // Check age category permissions
        if (tenantProfile.youngestChildAge !== null && tenantProfile.youngestChildAge !== undefined) {
          const youngestAge = tenantProfile.youngestChildAge;
          if (youngestAge < 2 && !property.allowInfants) return false;
          if (youngestAge >= 2 && youngestAge <= 5 && !property.allowToddlers) return false;
          if (youngestAge >= 6 && youngestAge <= 12 && !property.allowSchoolAge) return false;
          if (youngestAge >= 13 && youngestAge <= 17 && !property.allowTeens) return false;
        }
      }

      // Check pets
      if (!property.allowPets && tenantProfile.hasPets) {
        return false;
      }

      // Check smoking
      if (!property.allowSmoking && tenantProfile.smokingStatus === 'SMOKER') {
        return false;
      }

      // Check return time preference
      if (property.strictReturnTime && property.minReturnTime && tenantProfile.returnTimePreference) {
        // Parse times for comparison (HH:MM format)
        const tenantTime = tenantProfile.returnTimePreference;
        const landlordTime = property.minReturnTime;

        // Simple string comparison for HH:MM format
        if (tenantTime > landlordTime) {
          return false; // Tenant's return time is later than landlord's minimum
        }
      }

      // Check gender preference
      if (property.preferredGender && property.preferredGender !== 'ANY') {
        if (tenantProfile.gender !== property.preferredGender) return false;
      }

      return true;
    });

    return {
      ...result,
      data: compatibleProperties,
      total: compatibleProperties.length,
      totalPages: Math.ceil(compatibleProperties.length / (result.limit || 12)),
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
    this.validateCoordinatePair(dto.lat, dto.lng);
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
          lat: dto.lat,
          lng: dto.lng,
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
          // Landlord Preferences
          allowedOccupation: dto.allowedOccupation,
          allowedMaritalStatus: dto.allowedMaritalStatus,
          allowedFamilyType: dto.allowedFamilyType,
          maxFamilySize: dto.maxFamilySize,
          maxOccupancy: dto.maxOccupancy,
          minChildrenAge: dto.minChildrenAge,
          maxChildrenAge: dto.maxChildrenAge,
          allowInfants: dto.allowInfants ?? true,
          allowToddlers: dto.allowToddlers ?? true,
          allowSchoolAge: dto.allowSchoolAge ?? true,
          allowTeens: dto.allowTeens ?? true,
          allowPets: dto.allowPets ?? false,
          allowSmoking: dto.allowSmoking ?? false,
          strictReturnTime: dto.strictReturnTime ?? false,
          minReturnTime: dto.minReturnTime,
          quietHoursStart: dto.quietHoursStart,
          quietHoursEnd: dto.quietHoursEnd,
          preferredGender: dto.preferredGender,
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
    this.validateCoordinatePair(dto.lat, dto.lng);
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { photos: true, amenities: true },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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
          ...(dto.lat !== undefined && { lat: dto.lat }),
          ...(dto.lng !== undefined && { lng: dto.lng }),
          ...(dto.availableFrom !== undefined && { availableFrom: dto.availableFrom }),
          ...(dto.status !== undefined && { status: dto.status }),
          // Landlord Preferences
          ...(dto.allowedOccupation !== undefined && { allowedOccupation: dto.allowedOccupation }),
          ...(dto.allowedMaritalStatus !== undefined && { allowedMaritalStatus: dto.allowedMaritalStatus }),
          ...(dto.allowedFamilyType !== undefined && { allowedFamilyType: dto.allowedFamilyType }),
          ...(dto.maxFamilySize !== undefined && { maxFamilySize: dto.maxFamilySize }),
          ...(dto.maxOccupancy !== undefined && { maxOccupancy: dto.maxOccupancy }),
          ...(dto.minChildrenAge !== undefined && { minChildrenAge: dto.minChildrenAge }),
          ...(dto.maxChildrenAge !== undefined && { maxChildrenAge: dto.maxChildrenAge }),
          ...(dto.allowInfants !== undefined && { allowInfants: dto.allowInfants }),
          ...(dto.allowToddlers !== undefined && { allowToddlers: dto.allowToddlers }),
          ...(dto.allowSchoolAge !== undefined && { allowSchoolAge: dto.allowSchoolAge }),
          ...(dto.allowTeens !== undefined && { allowTeens: dto.allowTeens }),
          ...(dto.allowPets !== undefined && { allowPets: dto.allowPets }),
          ...(dto.allowSmoking !== undefined && { allowSmoking: dto.allowSmoking }),
          ...(dto.strictReturnTime !== undefined && { strictReturnTime: dto.strictReturnTime }),
          ...(dto.minReturnTime !== undefined && { minReturnTime: dto.minReturnTime }),
          ...(dto.quietHoursStart !== undefined && { quietHoursStart: dto.quietHoursStart }),
          ...(dto.quietHoursEnd !== undefined && { quietHoursEnd: dto.quietHoursEnd }),
          ...(dto.preferredGender !== undefined && { preferredGender: dto.preferredGender }),
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

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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

  async createCustomAmenity(userId: string, dto: CreateCustomAmenityDto) {
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');

    try {
      const amenity = await this.prisma.amenity.create({
        data: {
          name: dto.name.trim(),
          slug,
          category: dto.category,
          isCustom: true,
          createdBy: userId,
          usageCount: 0,
        },
      });

      return amenity;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('An amenity with this name already exists');
        }
      }
      throw error;
    }
  }
}
