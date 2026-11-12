import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma, PropertyStatus, NotificationType, VisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRentalApplicationDto } from './dto/create-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailQueueService: NotificationEmailQueueService,
  ) {}

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

    const application = await this.prisma.rentalApplication.create({
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
            landlordId: true,
          },
        },
      },
    });

    // Notify landlord
    await this.notificationsService.create(
      property.landlordId,
      NotificationType.APPLICATION_SUBMITTED,
      'New Rental Application',
      `A tenant has applied for your property: ${property.title}`,
      { applicationId: application.id, propertyId, tenantId },
    );

    // Send email to landlord
    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantId },
      select: { fullName: true },
    });
    await this.emailQueueService.queueNotificationEmail(
      property.landlordId,
      'NEW_APPLICATION',
      {
        propertyTitle: property.title,
        tenantName: tenant?.fullName || 'A tenant',
        propertyId,
        applicationId: application.id,
      },
    );

    return application;
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

    const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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

        // Auto-cancel pending visit requests for this property
        const pendingVisits = await tx.visitRequest.findMany({
          where: {
            propertyId: application.propertyId,
            status: VisitStatus.PENDING,
          },
          select: {
            id: true,
            tenantId: true,
          },
        });

        if (pendingVisits.length > 0) {
          await tx.visitRequest.updateMany({
            where: {
              propertyId: application.propertyId,
              status: VisitStatus.PENDING,
            },
            data: { status: VisitStatus.CANCELLED },
          });

          // Notify tenants whose visit requests were cancelled
          for (const visit of pendingVisits) {
            await this.notificationsService.create(
              visit.tenantId,
              NotificationType.VISIT_CANCELLED,
              'Visit Request Cancelled',
              `Your visit request for ${selectedApp.property.title} has been cancelled as the property is now rented`,
              { propertyId: application.propertyId },
            );

            // Send email notification
            await this.emailQueueService.queueNotificationEmail(
              visit.tenantId,
              'VISIT_CANCELLED',
              {
                propertyTitle: selectedApp.property.title,
                propertyId: application.propertyId,
              },
            );
          }
        }

        // Notify selected tenant
        await this.notificationsService.create(
          application.tenantId,
          NotificationType.APPLICATION_SELECTED,
          'Application Selected',
          `Congratulations! Your application for ${selectedApp.property.title} has been selected`,
          { applicationId, propertyId: application.propertyId },
        );

        // Send email to selected tenant
        await this.emailQueueService.queueNotificationEmail(
          application.tenantId,
          'APPLICATION_SELECTED',
          {
            propertyTitle: selectedApp.property.title,
            propertyId: application.propertyId,
            applicationId,
          },
        );

        return selectedApp;
      });
    }

    // Other status updates (UNDER_REVIEW, SHORTLISTED, REJECTED)
    const updatedApplication = await this.prisma.rentalApplication.update({
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

    // Send notifications based on status change
    let notificationType: NotificationType;
    let notificationTitle: string;
    let notificationMessage: string;
    let recipientId: string;

    if (dto.status === ApplicationStatus.UNDER_REVIEW) {
      notificationType = NotificationType.APPLICATION_UNDER_REVIEW;
      notificationTitle = 'Application Under Review';
      notificationMessage = `Your application for ${updatedApplication.property.title} is under review`;
      recipientId = application.tenantId;
    } else if (dto.status === ApplicationStatus.SHORTLISTED) {
      notificationType = NotificationType.APPLICATION_SHORTLISTED;
      notificationTitle = 'Application Shortlisted';
      notificationMessage = `Your application for ${updatedApplication.property.title} has been shortlisted`;
      recipientId = application.tenantId;
    } else if (dto.status === ApplicationStatus.REJECTED) {
      notificationType = NotificationType.APPLICATION_REJECTED;
      notificationTitle = 'Application Rejected';
      notificationMessage = `Your application for ${updatedApplication.property.title} has been rejected`;
      recipientId = application.tenantId;
    } else if (dto.status === ApplicationStatus.WITHDRAWN) {
      notificationType = NotificationType.APPLICATION_WITHDRAWN;
      notificationTitle = 'Application Withdrawn';
      notificationMessage = `An application for your property ${updatedApplication.property.title} has been withdrawn`;
      recipientId = application.property.landlordId;
    } else {
      return updatedApplication;
    }

    await this.notificationsService.create(
      recipientId,
      notificationType,
      notificationTitle,
      notificationMessage,
      { applicationId, propertyId: application.propertyId },
    );

    return updatedApplication;
  }
}
