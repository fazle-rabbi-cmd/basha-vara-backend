import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma, PropertyStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRentalApplicationDto } from './dto/create-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  async create(propertyId: string, tenantId: string, dto: CreateRentalApplicationDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    if (property.landlordId === tenantId) {
      throw new BadRequestException('You cannot apply for your own property');
    }

    if (property.status === PropertyStatus.RENTED || property.status === PropertyStatus.ARCHIVED) {
      throw new BadRequestException('This property is not currently accepting rental applications');
    }

    // Check for existing active application
    const existingActive = await this.prisma.rentalApplication.findFirst({
      where: {
        propertyId,
        tenantId,
        status: {
          in: [
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.SHORTLISTED,
            ApplicationStatus.SELECTED,
          ],
        },
      },
    });

    if (existingActive) {
      throw new BadRequestException('You already have an active application submitted for this property');
    }

    return this.prisma.rentalApplication.create({
      data: {
        propertyId,
        tenantId,
        coverNote: dto.coverNote?.trim() || null,
        moveInDate: dto.moveInDate,
        proposedRent: dto.proposedRent !== undefined ? new Prisma.Decimal(dto.proposedRent) : null,
        status: ApplicationStatus.SUBMITTED,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            photos: { take: 1 },
          },
        },
      },
    });
  }

  async findTenantApplications(tenantId: string) {
    return this.prisma.rentalApplication.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            status: true,
            photos: { take: 1 },
            landlord: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async findLandlordApplications(landlordId: string, propertyId?: string) {
    return this.prisma.rentalApplication.findMany({
      where: {
        property: {
          landlordId,
          ...(propertyId && { id: propertyId }),
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            tenantProfile: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
            rentAmount: true,
            status: true,
            photos: { take: 1 },
          },
        },
      },
    });
  }

  async updateStatus(
    applicationId: string,
    userId: string,
    roles: string[],
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: {
        property: true,
      },
    });

    if (!application) {
      throw new NotFoundException(`Rental application with ID ${applicationId} not found`);
    }

    const isAdmin = roles.includes(Role.ADMIN);
    const isLandlord = application.property.landlordId === userId;
    const isTenant = application.tenantId === userId;

    if (!isAdmin && !isLandlord && !isTenant) {
      throw new ForbiddenException('You do not have permission to modify this rental application');
    }

    // Tenant can only withdraw
    if (isTenant && !isAdmin && !isLandlord) {
      if (dto.status !== ApplicationStatus.WITHDRAWN) {
        throw new ForbiddenException('Tenants can only withdraw their own applications');
      }

      return this.prisma.rentalApplication.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.WITHDRAWN },
      });
    }

    // Landlord / Admin selection workflow
    if (dto.status === ApplicationStatus.SELECTED) {
      // Transactional boundary: select tenant, mark property RENTED, decline remaining applicants
      return this.prisma.$transaction(async (tx) => {
        const selectedApp = await tx.rentalApplication.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.SELECTED },
          include: {
            property: true,
            tenant: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

        // Mark property as RENTED
        await tx.property.update({
          where: { id: application.propertyId },
          data: { status: PropertyStatus.RENTED },
        });

        // Auto-reject other pending/under-review/shortlisted applications for this property
        await tx.rentalApplication.updateMany({
          where: {
            propertyId: application.propertyId,
            id: { not: applicationId },
            status: {
              in: [
                ApplicationStatus.SUBMITTED,
                ApplicationStatus.UNDER_REVIEW,
                ApplicationStatus.SHORTLISTED,
              ],
            },
          },
          data: { status: ApplicationStatus.REJECTED },
        });

        return selectedApp;
      });
    }

    // Other status updates (UNDER_REVIEW, SHORTLISTED, REJECTED)
    return this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: { status: dto.status },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            area: true,
          },
        },
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }
}
