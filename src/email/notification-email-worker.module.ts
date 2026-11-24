import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, PgBossModule],
  providers: [NotificationEmailWorkerService],
})
export class NotificationEmailWorkerModule {}
