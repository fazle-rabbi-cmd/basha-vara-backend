import { Module } from '@nestjs/common';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';

@Module({
  imports: [PrismaModule, PgBossModule],
  providers: [NotificationEmailWorkerService],
})
export class NotificationEmailWorkerModule {}
