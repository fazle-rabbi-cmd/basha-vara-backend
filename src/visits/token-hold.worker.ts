import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType, VisitStatus } from '@prisma/client';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { WORKFLOW_CONFIG } from '../config/workflow.config.js';

export type TokenHoldRefundReason =
  | 'LANDLORD_DECLINED'
  | 'LANDLORD_NO_SHOW'
  | 'LISTING_WITHDRAWN'
  | 'TENANT_WALKED_AWAY'
  | 'LOCK_EXPIRED';

@Injectable()
export class TokenHoldWorker {
  private readonly logger = new Logger(TokenHoldWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pgBoss: PgBossService,
  ) {}

  async onModuleInit() {
    this.pgBoss.work('token-hold-expire', async (job) => {
      await this.processTokenHoldExpiry(job.data.visitId);
    });

    this.pgBoss.work('token-hold-check', async (job) => {
      await this.checkExpiredTokenHolds();
    });

    this.logger.log('Token hold worker registered');

    // Schedule hourly check for expired token holds
    await this.pgBoss.schedule('token-hold-check', '0 * * * *', {});

    this.logger.log('Scheduled hourly token hold check');
  }

  async scheduleExpiry(visitId: string, expiryTime: Date) {
    if (expiryTime > new Date()) {
      await this.pgBoss.scheduleAfter('token-hold-expire', expiryTime, { visitId });
      this.logger.log(`Scheduled token hold expiry for visit ${visitId} at ${expiryTime.toISOString()}`);
    }
  }

  private async processTokenHoldExpiry(visitId: string) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit || !visit.tokenHoldAmount) {
      this.logger.log(`Skipping token hold expiry for visit ${visitId}: no token hold or not found`);
      return;
    }

    if (visit.tokenHoldExpiresAt && new Date() < visit.tokenHoldExpiresAt) {
      this.logger.log(`Skipping token hold expiry for visit ${visitId}: not yet expired`);
      return;
    }

    // Check if lease was signed (application accepted)
    const acceptedApplication = await this.prisma.rentalApplication.findFirst({
      where: {
        propertyId: visit.propertyId,
        tenantId: visit.tenantId,
        status: 'SELECTED',
      },
    });

    if (acceptedApplication) {
      this.logger.log(`Token hold for visit ${visitId} converted to lease, not expiring`);
      return;
    }

    // Expire token hold and unlock property
    await this.prisma.$transaction(async (tx) => {
      await tx.visitRequest.update({
        where: { id: visitId },
        data: {
          tokenHoldAmount: null,
          tokenHoldExpiresAt: null,
        },
      });

      await tx.property.update({
        where: { id: visit.propertyId },
        data: {
          lockedByVisitId: null,
          lockedUntil: null,
        },
      });
    });

    // Notify tenant about expiry and refund
    await this.notifications.create(
      visit.tenantId,
      NotificationType.SYSTEM,
      'Token Hold Expired',
      `Your token hold for ${visit.property.title} has expired. A refund has been initiated (minus gateway fees).`,
      { visitId, propertyId: visit.propertyId },
    );

    // Notify landlord
    await this.notifications.create(
      visit.property.landlordId,
      NotificationType.SYSTEM,
      'Property Unlocked',
      `The token hold for ${visit.property.title} has expired. The property is now available for other tenants.`,
      { visitId, propertyId: visit.propertyId },
    );

    this.logger.log(`Token hold expired for visit ${visitId}, property unlocked`);
  }

  private async checkExpiredTokenHolds() {
    const now = new Date();

    const expiredVisits = await this.prisma.visitRequest.findMany({
      where: {
        tokenHoldAmount: { not: null },
        tokenHoldExpiresAt: { lt: now },
      },
      include: { property: true, tenant: true },
    });

    this.logger.log(`Found ${expiredVisits.length} visits with expired token holds`);

    for (const visit of expiredVisits) {
      await this.processTokenHoldExpiry(visit.id);
    }
  }

  /**
   * Processes token hold refund based on the reason
   * Full refund for landlord-side causes, gateway fee for tenant walkaway
   */
  async processRefund(visitId: string, reason: TokenHoldRefundReason) {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true, tenant: true },
    });

    if (!visit || !visit.tokenHoldAmount) {
      this.logger.log(`No token hold to refund for visit ${visitId}`);
      return { refunded: false, reason: 'No token hold found' };
    }

    const refundAmount = Number(visit.tokenHoldAmount);
    let gatewayFee = 0;
    let finalRefundAmount = refundAmount;

    // Gateway fee only applies when tenant walks away
    if (reason === 'TENANT_WALKED_AWAY') {
      gatewayFee = Math.floor((refundAmount * WORKFLOW_CONFIG.escrow.platformFeeRateBasisPoints) / 10000) + WORKFLOW_CONFIG.escrow.platformFeeFixedPoisha;
      finalRefundAmount = refundAmount - gatewayFee;
    }

    // Clear token hold and unlock property
    await this.prisma.$transaction(async (tx) => {
      await tx.visitRequest.update({
        where: { id: visitId },
        data: {
          tokenHoldAmount: null,
          tokenHoldExpiresAt: null,
        },
      });

      await tx.property.update({
        where: { id: visit.propertyId },
        data: {
          lockedByVisitId: null,
          lockedUntil: null,
        },
      });
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: visit.tenantId,
        action: 'TOKEN_HOLD_REFUND',
        resource: 'VISIT',
        resourceId: visitId,
        details: {
          amount: refundAmount,
          gatewayFee,
          finalRefundAmount,
          reason,
          propertyId: visit.propertyId,
        },
        success: true,
      },
    });

    // Notify tenant
    const refundMessage = reason === 'TENANT_WALKED_AWAY'
      ? `Your token hold for ${visit.property.title} has been refunded (৳${finalRefundAmount}). Gateway fee of ৳${gatewayFee} was deducted.`
      : `Your token hold for ${visit.property.title} has been fully refunded (৳${refundAmount}).`;

    await this.notifications.create(
      visit.tenantId,
      NotificationType.SYSTEM,
      'Token Hold Refunded',
      refundMessage,
      { visitId, propertyId: visit.propertyId, refundAmount: finalRefundAmount, gatewayFee },
    );

    this.logger.log(`Token hold refunded for visit ${visitId}: amount=${refundAmount}, fee=${gatewayFee}, reason=${reason}`);

    return {
      refunded: true,
      amount: refundAmount,
      gatewayFee,
      finalRefundAmount,
      reason,
    };
  }

  /**
   * Handles token hold when landlord declines or listing is withdrawn
   */
  async handleLandlordSideCancellation(visitId: string, reason: 'LANDLORD_DECLINED' | 'LISTING_WITHDRAWN' | 'LANDLORD_NO_SHOW') {
    return this.processRefund(visitId, reason);
  }

  /**
   * Handles token hold when tenant walks away
   */
  async handleTenantWalkaway(visitId: string) {
    return this.processRefund(visitId, 'TENANT_WALKED_AWAY');
  }
}
