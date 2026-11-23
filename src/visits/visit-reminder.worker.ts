import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '@prisma/client';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';
import { PgBossService } from '../pg-boss/pg-boss.service.js';

@Injectable()
export class VisitReminderWorker {
  private readonly logger = new Logger(VisitReminderWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pgBoss: PgBossService,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('visit-reminder', async (job) => {
      await this.processReminder(job.data);
    });

    this.logger.log('Visit reminder worker registered');
  }

  private async processReminder(data: { visitId: string; reminderHours: number }) {
    const { visitId, reminderHours } = data;

    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit || visit.status !== 'CONFIRMED') {
      this.logger.log(`Skipping reminder for visit ${visitId}: not confirmed or not found`);
      return;
    }

    const scheduledStart = this.parseScheduledDateTime(visit);
    const now = new Date();
    const hoursUntilVisit = (scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (Math.abs(hoursUntilVisit - reminderHours) > 0.5) {
      this.logger.log(`Skipping reminder for visit ${visitId}: time mismatch`);
      return;
    }

    const reminderText = reminderHours === 1 ? '1 hour' : `${reminderHours} hours`;

    try {
      await this.notifications.create(
        visit.tenantId,
        NotificationType.VISIT_ACCEPTED,
        `Visit Reminder`,
        `Your visit to ${visit.property.title} is in ${reminderText}. Please arrive on time.`,
        { visitId, propertyId: visit.propertyId },
      );

      await this.notifications.create(
        visit.property.landlordId,
        NotificationType.VISIT_ACCEPTED,
        `Visit Reminder`,
        `You have a visit scheduled at ${visit.property.title} in ${reminderText}.`,
        { visitId, propertyId: visit.propertyId },
      );

      this.logger.log(`Reminder sent for visit ${visitId} (${reminderText} before)`);
    } catch (error) {
      this.logger.error(`Failed to send reminder for visit ${visitId}:`, error);
    }
  }

  async scheduleReminders(visitId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
    });

    if (!visit || visit.status !== 'CONFIRMED') {
      return;
    }

    const scheduledStart = this.parseScheduledDateTime(visit);

    for (const hours of WORKFLOW_CONFIG.visit.reminderHours) {
      const reminderTime = new Date(scheduledStart.getTime() - hours * 60 * 60 * 1000);

      if (reminderTime > new Date()) {
        await this.pgBoss.schedule('visit-reminder', { visitId, reminderHours: hours }, {
          startAfter: reminderTime,
        });
        this.logger.log(`Scheduled ${hours}h reminder for visit ${visitId} at ${reminderTime.toISOString()}`);
      }
    }
  }

  private parseScheduledDateTime(visit: any): Date {
    let slotDate = visit.requestedDate;
    let slotTime = visit.requestedTime;

    if (visit.confirmedSlot && typeof visit.confirmedSlot === 'object') {
      const cs = visit.confirmedSlot as any;
      if (cs.date && cs.time) {
        slotDate = cs.date;
        slotTime = cs.time;
      }
    }

    const [hours, minutes] = slotTime.split(':').map(Number);
    const scheduledDate = new Date(slotDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    return scheduledDate;
  }
}
