import { Module } from '@nestjs/common';
import { AuthEmailQueueService } from './auth-email-queue.service.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';

@Module({
  imports: [PgBossModule],
  providers: [AuthEmailQueueService],
  exports: [AuthEmailQueueService],
})
export class AuthEmailQueueModule {}
