import { Injectable } from '@nestjs/common';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import {
  AUTH_EMAIL_QUEUE,
  type AuthEmailJob,
  type AuthEmailPurpose,
} from './auth-email.types.js';

@Injectable()
export class AuthEmailQueueService {
  constructor(private readonly pgBoss: PgBossService) {}

  async queueEmail(userId: string, purpose: AuthEmailPurpose) {
    const job: AuthEmailJob = { userId, purpose };
    await this.pgBoss.send(AUTH_EMAIL_QUEUE, job, {
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
      retryDelayMax: 3600,
      singletonKey: `${purpose}-${userId}`,
      singletonSeconds: 60,
      deleteAfterSeconds: 86400,
    });
  }

  async queuePasswordLink(userId: string, purpose: AuthEmailPurpose) {
    return this.queueEmail(userId, purpose);
  }
}
