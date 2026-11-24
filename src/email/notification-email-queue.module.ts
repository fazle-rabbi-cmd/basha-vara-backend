import { Module } from '@nestjs/common';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NotificationDigestService } from './notification-digest.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';

@Module({
  imports: [PrismaModule, PgBossModule],
  providers: [
    NotificationEmailQueueService,
    NotificationDigestService,
  ],
  exports: [NotificationEmailQueueService, NotificationDigestService],
})
export class NotificationEmailQueueModule {}
