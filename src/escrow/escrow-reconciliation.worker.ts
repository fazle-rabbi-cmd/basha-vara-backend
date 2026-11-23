import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { EscrowStatus, PaymentStatus } from '@prisma/client';
import type { PaymentProvider } from '../payments/providers/payment-provider.interface.js';

@Injectable()
export class EscrowReconciliationWorker {
  private readonly logger = new Logger(EscrowReconciliationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pgBoss: PgBossService,
    @Inject('PAYMENT_PROVIDER') private paymentProvider: PaymentProvider,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('escrow-reconciliation', async (job) => {
      await this.performReconciliation();
    });

    this.logger.log('Escrow reconciliation worker registered');

    // Schedule daily reconciliation at 2 AM
    await this.pgBoss.schedule('escrow-reconciliation', {}, {
      cron: '0 2 * * *',
    });

    this.logger.log('Scheduled daily reconciliation at 2 AM');
  }

  private async performReconciliation() {
    this.logger.log('Starting daily escrow reconciliation');

    // Get all payments that should be reconciled
    const payments = await this.prisma.payment.findMany({
      where: {
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.COMPLETED],
        },
        transactionId: {
          not: null,
        },
      },
      include: {
        application: {
          include: {
            property: true,
          },
        },
      },
    });

    this.logger.log(`Reconciling ${payments.length} payments`);

    let discrepancies = 0;

    for (const payment of payments) {
      try {
        // Get payment status from provider
        const providerStatus = await this.paymentProvider.getPaymentStatus(payment.transactionId!);

        // Check for discrepancies
        if (payment.status === PaymentStatus.PENDING && providerStatus.status === 'COMPLETED') {
          this.logger.warn(`Payment ${payment.id} is PENDING in DB but COMPLETED in provider`);
          discrepancies++;

          // Update payment status
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              paidAt: new Date(),
            },
          });
        } else if (payment.status === PaymentStatus.COMPLETED && providerStatus.status === 'FAILED') {
          this.logger.error(`Payment ${payment.id} is COMPLETED in DB but FAILED in provider`);
          discrepancies++;
        }
      } catch (error) {
        this.logger.error(`Failed to reconcile payment ${payment.id}:`, error);
        discrepancies++;
      }
    }

    // Check escrow status consistency
    const heldPayments = await this.prisma.payment.findMany({
      where: {
        escrowStatus: EscrowStatus.HELD,
        status: PaymentStatus.COMPLETED,
      },
      include: {
        application: {
          include: {
            leaseAgreement: true,
          },
        },
      },
    });

    this.logger.log(`Checking ${heldPayments.length} held escrow payments`);

    for (const payment of heldPayments) {
      const lease = payment.application?.leaseAgreement;
      if (!lease) {
        this.logger.warn(`Payment ${payment.id} is HELD but has no active lease`);
        discrepancies++;
      }
    }

    this.logger.log(`Reconciliation complete. Found ${discrepancies} discrepancies.`);

    // Alert admin if discrepancies found
    if (discrepancies > 0) {
      await this.notifyAdmin(discrepancies);
    }
  }

  private async notifyAdmin(discrepancyCount: number) {
    // Find admin users
    const admins = await this.prisma.userRole.findMany({
      where: {
        role: {
          name: {
            in: ['ADMIN', 'SUPER_ADMIN'],
          },
        },
      },
      include: {
        user: true,
      },
    });

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          userId: admin.userId,
          type: 'SYSTEM',
          title: 'Escrow Reconciliation Alert',
          message: `Daily reconciliation found ${discrepancyCount} discrepancies. Please review.`,
          data: { discrepancyCount },
        },
      });
    }
  }
}
