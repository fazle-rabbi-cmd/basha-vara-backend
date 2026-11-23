import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service.js';
import { EscrowController } from './escrow.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PgBossModule } from '../pg-boss/pg-boss.module.js';
import { EscrowAutoReleaseWorker } from './escrow-auto-release.worker.js';
import { EscrowReconciliationWorker } from './escrow-reconciliation.worker.js';

@Module({
  imports: [PaymentsModule, PrismaModule, NotificationsModule, PgBossModule],
  providers: [EscrowService, EscrowAutoReleaseWorker, EscrowReconciliationWorker],
  controllers: [EscrowController],
  exports: [EscrowService],
})
export class EscrowModule {}
