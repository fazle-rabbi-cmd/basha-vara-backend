import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationMatrixService } from './notification-matrix.service.js';
import { NotificationPreferencesController } from './notification-preferences.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module.js';

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [NotificationsService, NotificationMatrixService],
  exports: [NotificationsService, NotificationMatrixService],
})
export class NotificationsModule {}
