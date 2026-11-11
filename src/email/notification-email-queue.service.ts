import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJob,
  type NotificationEmailPurpose,
} from './notification-email.types.js';

@Injectable()
export class NotificationEmailQueueService implements OnModuleDestroy {
  constructor(@Inject(NOTIFICATION_EMAIL_QUEUE) private readonly queue: Queue<NotificationEmailJob>) {}

  async queueNotificationEmail(
    userId: string,
    purpose: NotificationEmailPurpose,
    data: NotificationEmailJob['data'],
  ) {
    await this.queue.add(purpose, { userId, purpose, data }, {
      jobId: `${purpose.toLowerCase()}-${userId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: { age: 86_400 },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
