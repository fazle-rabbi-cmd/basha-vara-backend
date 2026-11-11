import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVisitRequestDto } from './dto/create-visit-request.dto.js';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto.js';
import { VisitStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailQueueService: NotificationEmailQueueService,
  ) {}

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

    const visit = await this.prisma.visitRequest.create({
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
            landlordId: true,
          },
        },
      },
    });

    // Notify landlord
    await this.notificationsService.create(
      property.landlordId,
      NotificationType.VISIT_REQUESTED,
      'New Visit Request',
      `A tenant has requested to visit your property: ${property.title}`,
      { visitId: visit.id, propertyId, tenantId },
    );

    // Send email to landlord
    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantId },
      select: { fullName: true },
    });
    await this.emailQueueService.queueNotificationEmail(
      property.landlordId,
      'NEW_VISIT_REQUEST',
      {
        propertyTitle: property.title,
        tenantName: tenant?.fullName || 'A tenant',
        visitDate: visit.requestedDate.toISOString().split('T')[0],
        visitTime: visit.requestedTime,
        propertyId,
        visitId: visit.id,
      },
    );

    return visit;
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

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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

    const updatedVisit = await this.prisma.visitRequest.update({
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

    // Send notifications based on status change
    let notificationType: NotificationType;
    let notificationTitle: string;
    let notificationMessage: string;
    let recipientId: string;
    let emailPurpose: string | null = null;

    if (dto.status === VisitStatus.ACCEPTED) {
      notificationType = NotificationType.VISIT_ACCEPTED;
      notificationTitle = 'Visit Request Accepted';
      notificationMessage = `Your visit request for ${updatedVisit.property.title} has been accepted`;
      recipientId = visit.tenantId;
      emailPurpose = 'VISIT_ACCEPTED';
    } else if (dto.status === VisitStatus.DECLINED) {
      notificationType = NotificationType.VISIT_DECLINED;
      notificationTitle = 'Visit Request Declined';
      notificationMessage = `Your visit request for ${updatedVisit.property.title} has been declined`;
      recipientId = visit.tenantId;
    } else if (dto.status === VisitStatus.CANCELLED) {
      notificationType = NotificationType.VISIT_CANCELLED;
      notificationTitle = 'Visit Request Cancelled';
      notificationMessage = `The visit request for ${updatedVisit.property.title} has been cancelled`;
      recipientId = isTenant ? visit.property.landlordId : visit.tenantId;
    } else if (dto.status === VisitStatus.COMPLETED) {
      notificationType = NotificationType.VISIT_COMPLETED;
      notificationTitle = 'Visit Completed';
      notificationMessage = `The visit for ${updatedVisit.property.title} has been marked as completed`;
      recipientId = visit.tenantId;
    } else {
      return updatedVisit;
    }

    await this.notificationsService.create(
      recipientId,
      notificationType,
      notificationTitle,
      notificationMessage,
      { visitId, propertyId: visit.propertyId },
    );

    // Send email for important notifications
    if (emailPurpose) {
      await this.emailQueueService.queueNotificationEmail(
        recipientId,
        emailPurpose as any,
        {
          propertyTitle: updatedVisit.property.title,
          visitDate: updatedVisit.requestedDate.toISOString().split('T')[0],
          visitTime: updatedVisit.requestedTime,
          propertyId: visit.propertyId,
          visitId,
        },
      );
    }

    return updatedVisit;
  }
}
