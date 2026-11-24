import { Injectable } from '@nestjs/common';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJob,
  type NotificationEmailPurpose,
} from './notification-email.types.js';

@Injectable()
export class NotificationEmailQueueService {
  constructor(private readonly pgBoss: PgBossService) {}

  async queueNotificationEmail(
    userId: string,
    purpose: NotificationEmailPurpose,
    data: NotificationEmailJob['data'],
  ) {
    const job: NotificationEmailJob = { userId, purpose, data };
    await this.pgBoss.send(NOTIFICATION_EMAIL_QUEUE, job, {
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      deleteAfterSeconds: 86400,
    });
  }
}
