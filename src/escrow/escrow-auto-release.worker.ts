import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType, EscrowStatus, PaymentStatus } from '@prisma/client';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';
import { EscrowService } from './escrow.service.js';

@Injectable()
export class EscrowAutoReleaseWorker {
  private readonly logger = new Logger(EscrowAutoReleaseWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pgBoss: PgBossService,
    private readonly escrowService: EscrowService,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('escrow-auto-release', async (job) => {
      await this.processAutoRelease(job.data.paymentId);
    });

    this.pgBoss.work('escrow-auto-release-check', async (job) => {
      await this.checkAutoReleaseEligible();
    });

    this.logger.log('Escrow auto-release worker registered');

    // Schedule hourly check for auto-release eligible payments
    await this.pgBoss.schedule('escrow-auto-release-check', {}, {
      cron: '0 * * * *',
    });

    this.logger.log('Scheduled hourly auto-release check');
  }

  async scheduleAutoRelease(paymentId: string, releaseTime: Date) {
    if (releaseTime > new Date()) {
      await this.pgBoss.schedule('escrow-auto-release', { paymentId }, {
        startAfter: releaseTime,
      });
      this.logger.log(`Scheduled auto-release for payment ${paymentId} at ${releaseTime.toISOString()}`);
    }
  }

  private async processAutoRelease(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        application: {
          include: {
            property: true,
            tenant: true,
          },
        },
      },
    });

    if (!payment || payment.escrowStatus !== EscrowStatus.HELD) {
      this.logger.log(`Skipping auto-release for payment ${paymentId}: not held or not found`);
      return;
    }

    // Check if tenant has confirmed move-in
    const leaseAgreement = await this.prisma.leaseAgreement.findFirst({
      where: {
        applicationId: payment.applicationId!,
        status: 'ACTIVE',
      },
    });

    if (!leaseAgreement) {
      this.logger.log(`Skipping auto-release for payment ${paymentId}: no active lease`);
      return;
    }

    // Check if 72h has passed since move-in
    const moveInDate = leaseAgreement.startDate;
    const autoReleaseTime = new Date(moveInDate.getTime() + WORKFLOW_CONFIG.escrow.autoReleaseAfterMoveInHours * 60 * 60 * 1000);

    if (new Date() < autoReleaseTime) {
      this.logger.log(`Skipping auto-release for payment ${paymentId}: 72h not yet passed`);
      return;
    }

    // Auto-release escrow
    try {
      await this.escrowService.releaseEscrow(
        payment.application?.property?.landlordId || '',
        {
          paymentId,
          releaseReason: 'Auto-release after 72h with no dispute',
        },
      );

      this.logger.log(`Auto-released escrow for payment ${paymentId}`);
    } catch (error) {
      this.logger.error(`Failed to auto-release escrow for payment ${paymentId}:`, error);
    }
  }

  private async checkAutoReleaseEligible() {
    const now = new Date();

    // Find payments that are HELD and have active leases
    const eligiblePayments = await this.prisma.payment.findMany({
      where: {
        escrowStatus: EscrowStatus.HELD,
        application: {
          leaseAgreement: {
            status: 'ACTIVE',
          },
        },
      },
      include: {
        application: {
          include: {
            leaseAgreement: true,
          },
        },
      },
    });

    this.logger.log(`Found ${eligiblePayments.length} payments eligible for auto-release check`);

    for (const payment of eligiblePayments) {
      const lease = payment.application?.leaseAgreement;
      if (!lease) continue;

      const moveInDate = lease.startDate;
      const autoReleaseTime = new Date(moveInDate.getTime() + WORKFLOW_CONFIG.escrow.autoReleaseAfterMoveInHours * 60 * 60 * 1000);

      if (now >= autoReleaseTime) {
        await this.processAutoRelease(payment.id);
      }
    }
  }
}
