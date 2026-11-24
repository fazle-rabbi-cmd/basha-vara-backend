import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  private boss: PgBoss;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for PgBoss');
    }
    this.boss = new PgBoss(dbUrl);
  }

  async onModuleInit() {
    await this.boss.start();
    // Create all queues needed
    const queues = [
      'visit-reminder',
      'visit-auto-expire',
      'visit-single-expire',
      'token-hold-check',
      'token-hold-expire',
      'application-payment-deadline-check',
      'application-payment-deadline',
      'escrow-auto-release-check',
      'escrow-auto-release',
      'escrow-reconciliation',
      'auth-email',
      'notification-email-queue',
    ];
    for (const queue of queues) {
      await this.boss.createQueue(queue);
    }
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  getBoss(): PgBoss {
    return this.boss;
  }

  async schedule(name: string, cron: string | null, data: any, options?: any) {
    try {
      return await this.boss.schedule(name, cron as string, data, options);
    } catch (error: any) {
      console.error(`Failed to schedule job ${name}:`, error);
      throw error;
    }
  }

  async scheduleAfter(name: string, startAfter: Date, data: any, options?: any) {
    try {
      // Use send() for one-time delayed jobs
      return await this.boss.send(name, data, { ...options, startAfter });
    } catch (error: any) {
      console.error(`Failed to schedule job ${name}:`, error);
      throw error;
    }
  }

  async send(name: string, data: any, options?: any) {
    return this.boss.send(name, data, options);
  }

  async work(name: string, handler: (job: any) => Promise<void>) {
    return this.boss.work(name, handler);
  }
}
