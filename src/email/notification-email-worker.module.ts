import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [NotificationEmailWorkerService],
})
export class NotificationEmailWorkerModule {}
