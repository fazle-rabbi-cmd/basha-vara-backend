import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service.js';
import {
  ApplicationsController,
  TenantApplicationsController,
  LandlordApplicationsController,
  PropertyApplicationsController,
} from './applications.controller.js';
import { ApplicationProfilesService } from './application-profiles.service.js';
import { ApplicationProfilesController } from './application-profiles.controller.js';
import { ApplicationDocumentsService } from './application-documents.service.js';
import { ApplicationDocumentsController } from './application-documents.controller.js';
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
    ApplicationProfilesController,
    ApplicationDocumentsController,
  ],
  providers: [ApplicationsService, ApplicationProfilesService, ApplicationDocumentsService],
  exports: [ApplicationsService, ApplicationProfilesService, ApplicationDocumentsService],
})
export class ApplicationsModule {}
