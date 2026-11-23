import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrustScoreHistory } from '@prisma/client';

export enum TrustEventType {
  VISIT_COMPLETED = 'VISIT_COMPLETED',
  VISIT_NO_SHOW = 'VISIT_NO_SHOW',
  LANDLORD_NO_SHOW = 'LANDLORD_NO_SHOW',
  PAYMENT_ACKNOWLEDGED = 'PAYMENT_ACKNOWLEDGED',
  PAYMENT_LATE = 'PAYMENT_LATE',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  LISTING_VERIFIED = 'LISTING_VERIFIED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
}

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private prisma: PrismaService) {}

  async updateTrustScore(
    userId: string,
    userType: 'LANDLORD' | 'TENANT',
    eventType: TrustEventType,
    eventId?: string,
    metadata?: any,
  ): Promise<void> {
    const currentScore = userType === 'LANDLORD'
      ? await this.getLandlordTrustScore(userId)
      : await this.getTenantTrustScore(userId);

    const scoreChange = this.calculateScoreChange(eventType, metadata);
    const newScore = Math.max(0, Math.min(100, currentScore + scoreChange));

    // Update user profile
    if (userType === 'LANDLORD') {
      await this.prisma.landlordProfile.update({
        where: { userId },
        data: { trustScore: newScore },
      });
    }

    // Record history
    await this.prisma.trustScoreHistory.create({
      data: {
        userId,
        userType,
        oldScore: currentScore,
        newScore,
        changeReason: this.getChangeReason(eventType),
        eventType,
        eventId,
        metadata,
      },
    });

    this.logger.log(`Trust score updated for ${userType} ${userId}: ${currentScore} -> ${newScore} (${eventType})`);
  }

  async getLandlordTrustScore(userId: string): Promise<number> {
    const profile = await this.prisma.landlordProfile.findUnique({
      where: { userId },
      select: { trustScore: true },
    });

    return profile?.trustScore ?? 100;
  }

  async getTenantTrustScore(userId: string): Promise<number> {
    // For tenants, we compute trust score from verified events
    // This is a simplified implementation - can be expanded
    const completedVisits = await this.prisma.visitRequest.count({
      where: {
        tenantId: userId,
        status: 'COMPLETED',
        visitVerifiedAt: { not: null },
      },
    });

    const noShows = await this.prisma.visitRequest.count({
      where: {
        tenantId: userId,
        status: 'NO_SHOW',
      },
    });

    const acknowledgedPayments = await this.prisma.rentPayment.count({
      where: {
        tenantId: userId,
        status: 'ACKNOWLEDGED',
      },
    });

    const latePayments = await this.prisma.rentPayment.count({
      where: {
        tenantId: userId,
        status: 'OVERDUE',
      },
    });

    // Base score of 100
    let score = 100;

    // Positive events
    score += completedVisits * 5;
    score += acknowledgedPayments * 3;

    // Negative events
    score -= noShows * 10;
    score -= latePayments * 5;

    return Math.max(0, Math.min(100, score));
  }

  async getTrustScoreHistory(userId: string, limit = 50): Promise<TrustScoreHistory[]> {
    return this.prisma.trustScoreHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private calculateScoreChange(eventType: TrustEventType, metadata?: any): number {
    switch (eventType) {
      case TrustEventType.VISIT_COMPLETED:
        return 5;
      case TrustEventType.VISIT_NO_SHOW:
        return -10;
      case TrustEventType.LANDLORD_NO_SHOW:
        return -15;
      case TrustEventType.PAYMENT_ACKNOWLEDGED:
        return 3;
      case TrustEventType.PAYMENT_LATE:
        return -5;
      case TrustEventType.DISPUTE_RESOLVED:
        return metadata?.resolution === 'tenant_favorable' ? 5 : -5;
      case TrustEventType.LISTING_VERIFIED:
        return 10;
      case TrustEventType.REVIEW_RECEIVED:
        return metadata?.rating >= 4 ? 2 : metadata?.rating <= 2 ? -2 : 0;
      default:
        return 0;
    }
  }

  private getChangeReason(eventType: TrustEventType): string {
    switch (eventType) {
      case TrustEventType.VISIT_COMPLETED:
        return 'Completed verified visit';
      case TrustEventType.VISIT_NO_SHOW:
        return 'No-show for scheduled visit';
      case TrustEventType.LANDLORD_NO_SHOW:
        return 'Landlord no-show for scheduled visit';
      case TrustEventType.PAYMENT_ACKNOWLEDGED:
        return 'Rent payment acknowledged on time';
      case TrustEventType.PAYMENT_LATE:
        return 'Late rent payment';
      case TrustEventType.DISPUTE_RESOLVED:
        return 'Dispute resolved';
      case TrustEventType.LISTING_VERIFIED:
        return 'Listing verification approved';
      case TrustEventType.REVIEW_RECEIVED:
        return 'Review received';
      default:
        return 'Unknown event';
    }
  }
}
