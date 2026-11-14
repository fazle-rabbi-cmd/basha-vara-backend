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
import { OtpService } from '../common/services/otp.service.js';

@Module({
  imports: [PrismaModule, NotificationsModule, NotificationEmailQueueModule],
  controllers: [
    VisitsController,
    TenantVisitsController,
    LandlordVisitsController,
    PropertyVisitsController,
  ],
  providers: [VisitsService, OtpService],
  exports: [VisitsService],
})
export class VisitsModule {}
