import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private boss: any;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required for PgBoss');
    }
    const PgBoss = require('pg-boss');
    this.boss = new PgBoss(dbUrl);
  }

  async onModuleInit() {
    await this.boss.start();
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  getBoss(): any {
    return this.boss;
  }

  async schedule(name: string, data: any, options?: { startAfter?: Date; cron?: string }) {
    return this.boss.schedule(name, data, options);
  }

  async work(name: string, handler: (job: any) => Promise<void>) {
    return this.boss.work(name, handler);
  }
}
