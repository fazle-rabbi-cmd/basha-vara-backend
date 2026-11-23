import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReviewDto, ReviewResponseDto } from './dto/review.dto.js';
import { LeaseStatus, VisitStatus, NotificationType } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    // Validate rating
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Determine if review is verified (based on completed lease or verified visit)
    let isVerified = false;
    let leaseId: string | undefined;
    let visitId: string | undefined;

    if (dto.leaseId) {
      const lease = await this.prisma.leaseAgreement.findUnique({
        where: { id: dto.leaseId },
        include: { tenant: true, landlord: true },
      });

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      // Check if user is part of the lease
      if (lease.tenantId !== userId && lease.landlordId !== userId) {
        throw new ForbiddenException('You are not part of this lease');
      }

      // Check if lease is completed (ACTIVE means completed lease)
      if (lease.status !== LeaseStatus.ACTIVE) {
        throw new BadRequestException('Can only review active leases');
      }

      isVerified = true;
      leaseId = dto.leaseId;
    } else if (dto.visitId) {
      const visit = await this.prisma.visitRequest.findUnique({
        where: { id: dto.visitId },
        include: { tenant: true, property: true },
      });

      if (!visit) {
        throw new NotFoundException('Visit not found');
      }

      // Check if user is part of the visit
      if (visit.tenantId !== userId && visit.property.landlordId !== userId) {
        throw new ForbiddenException('You are not part of this visit');
      }

      // Check if visit is completed and verified
      if (visit.status !== VisitStatus.COMPLETED || !visit.visitVerifiedAt) {
        throw new BadRequestException('Can only review verified visits');
      }

      isVerified = true;
      visitId = dto.visitId;
    } else {
      throw new BadRequestException('Either leaseId or visitId must be provided');
    }

    // Determine reviewee (the other party)
    let revieweeId: string;
    if (leaseId) {
      const lease = await this.prisma.leaseAgreement.findUnique({ where: { id: leaseId } });
      revieweeId = lease?.tenantId === userId ? lease?.landlordId! : lease?.tenantId!;
    } else {
      const visit = await this.prisma.visitRequest.findUnique({
        where: { id: visitId },
        include: { property: true },
      });
      revieweeId = visit?.tenantId === userId ? visit?.property?.landlordId! : visit?.tenantId!;
    }

    // Check if review already exists
    const existing = await this.prisma.review.findFirst({
      where: {
        reviewerId: userId,
        revieweeId,
        propertyId: dto.propertyId,
      },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this user for this property');
    }

    const review = await this.prisma.review.create({
      data: {
        reviewerId: userId,
        revieweeId,
        propertyId: dto.propertyId,
        leaseId,
        visitId,
        rating: dto.rating,
        comment: dto.comment,
        isVerified,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Notify reviewee
    await this.prisma.notification.create({
      data: {
        userId: revieweeId,
        type: NotificationType.NEW_REVIEW,
        title: 'New Review Received',
        message: `You received a ${dto.rating}-star review for ${review.property.title}`,
        data: { reviewId: review.id, rating: dto.rating, propertyId: dto.propertyId },
      },
    });

    return this.mapToResponse(review);
  }

  async getReviewsForUser(userId: string, userRoles: string[]): Promise<ReviewResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    let where: any = {};

    if (!isAdmin) {
      where = {
        OR: [
          { reviewerId: userId },
          { revieweeId: userId },
        ],
      };
    }

    const reviews = await this.prisma.review.findMany({
      where,
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapToResponse(r));
  }

  async getReviewsForProperty(propertyId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { propertyId },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapToResponse(r));
  }

  async getUserRating(userId: string): Promise<{ averageRating: number; totalReviews: number }> {
    const reviews = await this.prisma.review.findMany({
      where: { revieweeId: userId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
    };
  }

  private mapToResponse(review: any): ReviewResponseDto {
    return {
      id: review.id,
      reviewerId: review.reviewerId,
      revieweeId: review.revieweeId,
      propertyId: review.propertyId,
      leaseId: review.leaseId,
      visitId: review.visitId,
      rating: review.rating,
      comment: review.comment,
      isVerified: review.isVerified,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      reviewer: review.reviewer ? {
        id: review.reviewer.id,
        fullName: review.reviewer.fullName,
        avatarUrl: review.reviewer.avatarUrl,
      } : undefined,
      reviewee: review.reviewee ? {
        id: review.reviewee.id,
        fullName: review.reviewee.fullName,
        avatarUrl: review.reviewee.avatarUrl,
      } : undefined,
      property: review.property ? {
        id: review.property.id,
        title: review.property.title,
      } : undefined,
    };
  }
}
