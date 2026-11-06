import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVisitRequestDto } from './dto/create-visit-request.dto.js';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto.js';
import { Role, VisitStatus } from '@prisma/client';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async create(propertyId: string, tenantId: string, dto: CreateVisitRequestDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    if (property.landlordId === tenantId) {
      throw new BadRequestException('You cannot request a visit to your own property');
    }

    // Check if there is already a pending visit request for this property by this tenant
    const existingPending = await this.prisma.visitRequest.findFirst({
      where: {
        propertyId,
        tenantId,
        status: VisitStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException('You already have an active pending visit request for this property');
    }

    return this.prisma.visitRequest.create({
      data: {
        propertyId,
        tenantId,
        requestedDate: dto.requestedDate,
        requestedTime: dto.requestedTime.trim(),
        message: dto.message?.trim() || null,
        status: VisitStatus.PENDING,
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

  async findTenantVisits(tenantId: string) {
    return this.prisma.visitRequest.findMany({
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

  async findLandlordVisits(landlordId: string) {
    return this.prisma.visitRequest.findMany({
      where: {
        property: {
          landlordId,
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
            photos: { take: 1 },
          },
        },
      },
    });
  }

  async updateStatus(
    visitId: string,
    userId: string,
    roles: string[],
    dto: UpdateVisitStatusDto,
  ) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: {
        property: true,
      },
    });

    if (!visit) {
      throw new NotFoundException(`Visit request with ID ${visitId} not found`);
    }

    const isAdmin = roles.includes(Role.ADMIN);
    const isLandlord = visit.property.landlordId === userId;
    const isTenant = visit.tenantId === userId;

    if (!isAdmin && !isLandlord && !isTenant) {
      throw new ForbiddenException('You do not have permission to modify this visit request');
    }

    // Role-specific status transitions
    if (isTenant && !isAdmin && !isLandlord) {
      if (dto.status !== VisitStatus.CANCELLED) {
        throw new ForbiddenException('Tenants are only permitted to cancel their own visit requests');
      }
    }

    if (isLandlord && !isAdmin) {
      if (dto.status === VisitStatus.CANCELLED && visit.status !== VisitStatus.PENDING) {
        throw new BadRequestException('Cannot cancel an already processed visit request');
      }
    }

    return this.prisma.visitRequest.update({
      where: { id: visitId },
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
