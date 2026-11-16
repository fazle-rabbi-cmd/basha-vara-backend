import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { NOTIFICATION_EMAIL_QUEUE } from './notification-email.types.js';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NotificationDigestService } from './notification-digest.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: NOTIFICATION_EMAIL_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = new Redis(
          config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379',
          { maxRetriesPerRequest: null },
        );
        return new Queue(NOTIFICATION_EMAIL_QUEUE, { connection });
      },
    },
    NotificationEmailQueueService,
    NotificationDigestService,
  ],
  exports: [NotificationEmailQueueService, NotificationDigestService],
})
export class NotificationEmailQueueModule {}
