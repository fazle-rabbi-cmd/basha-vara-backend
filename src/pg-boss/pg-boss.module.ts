import { Module } from '@nestjs/common';
import { PgBossService } from './pg-boss.service.js';

@Module({
  providers: [PgBossService],
  exports: [PgBossService],
})
export class PgBossModule {}
