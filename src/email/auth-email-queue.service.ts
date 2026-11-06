import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AUTH_EMAIL_QUEUE,
  type AuthEmailJob,
  type AuthEmailPurpose,
} from './auth-email.types.js';

@Injectable()
export class AuthEmailQueueService implements OnModuleDestroy {
  constructor(@Inject(AUTH_EMAIL_QUEUE) private readonly queue: Queue<AuthEmailJob>) {}

  async queuePasswordLink(userId: string, purpose: AuthEmailPurpose) {
    await this.queue.add(purpose, { userId, purpose }, {
      jobId: `${purpose.toLowerCase()}-${userId}-${Math.floor(Date.now() / 60_000)}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: { age: 86_400 },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}