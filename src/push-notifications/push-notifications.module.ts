import { Module } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service.js';
import { PushNotificationsController } from './push-notifications.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [PushNotificationsService],
  controllers: [PushNotificationsController],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
