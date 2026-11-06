import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { AUTH_EMAIL_QUEUE } from './auth-email.types.js';
import { AuthEmailQueueService } from './auth-email-queue.service.js';

@Module({
  providers: [
    {
      provide: AUTH_EMAIL_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = new Redis(
          config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379',
          { maxRetriesPerRequest: null },
        );
        return new Queue(AUTH_EMAIL_QUEUE, { connection });
      },
    },
    AuthEmailQueueService,
  ],
  exports: [AuthEmailQueueService],
})
export class AuthEmailQueueModule {}