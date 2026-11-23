import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';

@Module({
  imports: [PrismaModule, PgBossModule],
  controllers: [HealthController],
})
export class HealthModule {}
