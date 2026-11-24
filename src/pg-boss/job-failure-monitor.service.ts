import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '@prisma/client';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';

interface FailedJobRow {
  id: string;
  name: string;
  data: any;
  created_on: Date;
  completed_on: Date | null;
  retry_count: number;
  retry_limit: number;
}

@Injectable()
export class JobFailureMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobFailureMonitorService.name);
  private interval: NodeJS.Timeout | null = null;
  private lastCheck: Date = new Date();
  private alertedJobIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const intervalMs = WORKFLOW_CONFIG.jobs.failureCheckIntervalMinutes * 60 * 1000;
    this.interval = setInterval(() => {
      this.checkFailedJobs().catch((error) => {
        this.logger.error(`Failed job check error: ${error.message}`);
      });
    }, intervalMs);
    this.interval.unref();
    this.logger.log(`Job failure monitor started (every ${WORKFLOW_CONFIG.jobs.failureCheckIntervalMinutes}m)`);
  }

  async onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async checkFailedJobs(): Promise<number> {
    const since = new Date(Date.now() - WORKFLOW_CONFIG.jobs.failureLookbackHours * 60 * 60 * 1000);
    const watermark = this.lastCheck > since ? this.lastCheck : since;

    let rows: FailedJobRow[];
    try {
      rows = await this.prisma.$queryRaw<FailedJobRow[]>`
        SELECT id, name, data, created_on, completed_on, retry_count, retry_limit
        FROM pgboss.job
        WHERE state = 'failed'
          AND completed_on > ${watermark}
        ORDER BY completed_on ASC
        LIMIT 500
      `;
    } catch (error: any) {
      this.logger.warn(`Could not query pgboss.job (schema may not exist yet): ${error.message}`);
      this.lastCheck = new Date();
      return 0;
    }

    const newFailures = rows.filter((row) => !this.alertedJobIds.has(row.id));
    if (newFailures.length === 0) {
      this.lastCheck = new Date();
      return 0;
    }

    const byQueue = new Map<string, FailedJobRow[]>();
    for (const row of newFailures) {
      const list = byQueue.get(row.name) ?? [];
      list.push(row);
      byQueue.set(row.name, list);
    }

    await this.notifyAdmins(byQueue);

    for (const row of newFailures) {
      this.alertedJobIds.add(row.id);
      if (this.alertedJobIds.size > 10_000) {
        this.alertedJobIds.clear();
      }
    }
    this.lastCheck = new Date();

    this.logger.warn(`Alerted admins about ${newFailures.length} failed job(s) across ${byQueue.size} queue(s)`);
    return newFailures.length;
  }

  private async notifyAdmins(byQueue: Map<string, FailedJobRow[]>) {
    const admins = await this.prisma.userRole.findMany({
      where: {
        role: { name: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      },
      select: { userId: true },
    });

    if (admins.length === 0) return;

    const queueSummary = [...byQueue.entries()]
      .map(([name, jobs]) => `${name}: ${jobs.length}`)
      .join(', ');

    for (const admin of admins) {
      try {
        await this.notifications.create(
          admin.userId,
          NotificationType.SYSTEM,
          'Background job failures detected',
          `${newFailuresCount(byQueue)} job(s) failed permanently and need attention. By queue: ${queueSummary}`,
          { failedJobs: [...byQueue.entries()].map(([name, jobs]) => ({ queue: name, count: jobs.length, jobIds: jobs.map((j) => j.id) })) },
        );
      } catch (error: any) {
        this.logger.error(`Failed to notify admin ${admin.userId}: ${error.message}`);
      }
    }
  }
}

function newFailuresCount(byQueue: Map<string, FailedJobRow[]>): number {
  return [...byQueue.values()].reduce((sum, jobs) => sum + jobs.length, 0);
}
