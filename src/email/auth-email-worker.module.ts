import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';
import { AuthEmailWorkerService } from './auth-email-worker.service.js';

@Module({
  imports: [PrismaModule, PgBossModule],
  providers: [AuthEmailWorkerService],
})
export class AuthEmailWorkerModule {}
