import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType, VisitStatus } from '@prisma/client';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';

@Injectable()
export class VisitAutoExpireWorker {
  private readonly logger = new Logger(VisitAutoExpireWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pgBoss: PgBossService,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('visit-auto-expire', async (jobs: unknown[]) => {
      for (const _job of jobs) {
        await this.processAutoExpire();
      }
    });

    this.pgBoss.work('visit-single-expire', async (jobs: { data: { visitId: string } }[]) => {
      for (const job of jobs) {
        await this.processSingleExpire(job.data.visitId);
      }
    });

    this.logger.log('Visit auto-expire worker registered');

    await this.pgBoss.schedule('visit-auto-expire', '0 * * * *', {});

    this.logger.log('Scheduled hourly visit auto-expire job');
  }

  private async processAutoExpire() {
    const expiryThreshold = new Date(Date.now() - WORKFLOW_CONFIG.visit.requestExpiryHours * 60 * 60 * 1000);

    const expiredVisits = await this.prisma.visitRequest.findMany({
      where: {
        status: VisitStatus.REQUESTED,
        createdAt: { lt: expiryThreshold },
      },
      include: { property: true, tenant: true },
    });

    this.logger.log(`Found ${expiredVisits.length} visits to auto-expire`);

    for (const visit of expiredVisits) {
      await this.processSingleExpire(visit.id);
    }
  }

  private async processSingleExpire(visitId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit || visit.status !== VisitStatus.REQUESTED) {
      return;
    }

    const expiryThreshold = new Date(Date.now() - WORKFLOW_CONFIG.visit.requestExpiryHours * 60 * 60 * 1000);

    if (visit.createdAt >= expiryThreshold) {
      return;
    }

    try {
      await this.prisma.visitRequest.update({
        where: { id: visitId },
        data: {
          status: VisitStatus.EXPIRED,
          expiredAt: new Date(),
        },
      });

      await this.notifications.create(
        visit.tenantId,
        NotificationType.VISIT_CANCELLED,
        'Visit Request Expired',
        `Your visit request for ${visit.property.title} has expired because the landlord did not respond within 48 hours.`,
        { visitId, propertyId: visit.propertyId },
      );

      await this.notifications.create(
        visit.property.landlordId,
        NotificationType.VISIT_CANCELLED,
        'Visit Request Expired',
        `A visit request for ${visit.property.title} has expired due to no response.`,
        { visitId, propertyId: visit.propertyId },
      );

      this.logger.log(`Auto-expired visit ${visitId}`);
    } catch (error) {
      this.logger.error(`Failed to auto-expire visit ${visitId}:`, error);
    }
  }

  async scheduleSingleExpire(visitId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
    });

    if (!visit || visit.status !== VisitStatus.REQUESTED) {
      return;
    }

    const expireTime = new Date(visit.createdAt.getTime() + WORKFLOW_CONFIG.visit.requestExpiryHours * 60 * 60 * 1000);

    if (expireTime > new Date()) {
      await this.pgBoss.scheduleAfter('visit-single-expire', expireTime, { visitId });
      this.logger.log(`Scheduled single auto-expire for visit ${visitId} at ${expireTime.toISOString()}`);
    }
  }
}
