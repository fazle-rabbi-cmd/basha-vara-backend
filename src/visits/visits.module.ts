import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service.js';
import {
  VisitsController,
  TenantVisitsController,
  LandlordVisitsController,
  PropertyVisitsController,
} from './visits.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NotificationEmailQueueModule } from '../email/notification-email-queue.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { OtpService } from '../common/services/otp.service.js';
import { IcsGeneratorService } from './services/ics-generator.service.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';
import { VisitReminderWorker } from './visit-reminder.worker.js';
import { VisitAutoExpireWorker } from './visit-auto-expire.worker.js';
import { TokenHoldWorker } from './token-hold.worker.js';

@Module({
  imports: [PrismaModule, NotificationsModule, NotificationEmailQueueModule, MessagesModule, PgBossModule],
  controllers: [
    VisitsController,
    TenantVisitsController,
    LandlordVisitsController,
    PropertyVisitsController,
  ],
  providers: [VisitsService, OtpService, IcsGeneratorService, VisitReminderWorker, VisitAutoExpireWorker, TokenHoldWorker],
  exports: [VisitsService, IcsGeneratorService],
})
export class VisitsModule {}
