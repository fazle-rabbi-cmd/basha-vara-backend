import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType, ApplicationStatus, PropertyStatus } from '@prisma/client';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { ApplicationsService } from './applications.service.js';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';

@Injectable()
export class ApplicationPaymentDeadlineWorker {
  private readonly logger = new Logger(ApplicationPaymentDeadlineWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pgBoss: PgBossService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('application-payment-deadline', async (job) => {
      await this.processPaymentDeadline(job.data.applicationId);
    });

    this.pgBoss.work('application-payment-deadline-check', async (job) => {
      await this.checkExpiredDeadlines();
    });

    this.logger.log('Application payment deadline worker registered');

    // Schedule hourly check for expired deadlines
    await this.pgBoss.schedule('application-payment-deadline-check', '0 * * * *', {});

    this.logger.log('Scheduled hourly payment deadline check');
  }

  private async processPaymentDeadline(applicationId: string) {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: { property: true, tenant: true },
    });

    if (!application || application.status !== ApplicationStatus.SELECTED) {
      this.logger.log(`Skipping payment deadline for application ${applicationId}: not SELECTED or not found`);
      return;
    }

    if (!application.paymentDeadline) {
      this.logger.log(`Skipping payment deadline for application ${applicationId}: no deadline set`);
      return;
    }

    const now = new Date();
    if (now < application.paymentDeadline) {
      this.logger.log(`Skipping payment deadline for application ${applicationId}: deadline not yet reached`);
      return;
    }

    // Mark as EXPIRED
    await this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.EXPIRED },
    });

    // Notify tenant
    await this.notifications.create(
      application.tenantId,
      NotificationType.APPLICATION_REJECTED,
      'Payment Deadline Expired',
      `Your payment deadline for ${application.property.title} has expired. Your application has been expired.`,
      { applicationId, propertyId: application.propertyId },
    );

    this.logger.log(`Payment deadline expired for application ${applicationId}`);

    // Promote next waitlisted applicant
    try {
      const result = await this.applicationsService.promoteNextWaitlisted(application.propertyId);
      this.logger.log(`Promoted next waitlisted applicant for property ${application.propertyId}: ${result.promoted}`);
    } catch (error) {
      this.logger.error(`Failed to promote next waitlisted applicant for property ${application.propertyId}:`, error);
    }
  }

  private async checkExpiredDeadlines() {
    const now = new Date();

    const expiredApplications = await this.prisma.rentalApplication.findMany({
      where: {
        status: ApplicationStatus.SELECTED,
        paymentDeadline: { lt: now },
      },
      include: { property: true, tenant: true },
    });

    this.logger.log(`Found ${expiredApplications.length} applications with expired payment deadlines`);

    for (const application of expiredApplications) {
      await this.processPaymentDeadline(application.id);
    }
  }

  async schedulePaymentDeadline(applicationId: string, deadline: Date) {
    if (deadline > new Date()) {
      await this.pgBoss.scheduleAfter('application-payment-deadline', deadline, { applicationId });
      this.logger.log(`Scheduled payment deadline for application ${applicationId} at ${deadline.toISOString()}`);
    }
  }
}
