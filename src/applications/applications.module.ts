import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service.js';
import {
  ApplicationsController,
  TenantApplicationsController,
  LandlordApplicationsController,
  PropertyApplicationsController,
} from './applications.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NotificationEmailQueueModule } from '../email/notification-email-queue.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule, NotificationEmailQueueModule],
  controllers: [
    ApplicationsController,
    TenantApplicationsController,
    LandlordApplicationsController,
    PropertyApplicationsController,
  ],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
