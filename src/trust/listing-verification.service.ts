import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListingVerificationDto, ListingVerificationResponseDto } from './dto/listing-verification.dto.js';
import { ListingVerificationStatus, NotificationType } from '@prisma/client';

@Injectable()
export class ListingVerificationService {
  constructor(private prisma: PrismaService) {}

  async submitVerification(userId: string, dto: ListingVerificationDto): Promise<ListingVerificationResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { landlord: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.landlordId !== userId) {
      throw new ForbiddenException('Only property owner can submit verification');
    }

    // Check if verification already exists
    const existing = await this.prisma.listingVerification.findFirst({
      where: {
        propertyId: dto.propertyId,
        status: ListingVerificationStatus.PENDING,
      },
    });

    if (existing) {
      throw new BadRequestException('Verification already pending for this property');
    }

    // Generate perceptual hash for duplicate detection
    const documentHash = await this.generatePerceptualHash(dto.documentUrl);

    const verification = await this.prisma.listingVerification.create({
      data: {
        propertyId: dto.propertyId,
        landlordId: userId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
        documentHash,
        status: ListingVerificationStatus.PENDING,
      },
      include: {
        property: true,
        landlord: true,
      },
    });

    // Check for duplicate documents
    if (documentHash) {
      const duplicates = await this.prisma.listingVerification.findMany({
        where: {
          documentHash,
          id: { not: verification.id },
          status: ListingVerificationStatus.APPROVED,
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              addressLine: true,
            },
          },
        },
      });

      if (duplicates.length > 0) {
        // Flag for admin review
        await this.prisma.notification.create({
          data: {
            userId: userId,
            type: NotificationType.LISTING_VERIFICATION_DUPLICATE,
            title: 'Duplicate Document Detected',
            message: 'Your document appears to be similar to an existing verified document. Please contact support.',
            data: { verificationId: verification.id, duplicates: duplicates.length },
          },
        });
      }
    }

    return this.mapToResponse(verification);
  }

  async getVerifications(userId: string, userRoles: string[]): Promise<ListingVerificationResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    let where: any = {};

    if (!isAdmin) {
      where = {
        OR: [
          { landlordId: userId },
          { property: { landlordId: userId } },
        ],
      };
    }

    const verifications = await this.prisma.listingVerification.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return verifications.map((v) => this.mapToResponse(v));
  }

  async reviewVerification(
    verificationId: string,
    adminId: string,
    status: ListingVerificationStatus,
    rejectionReason?: string,
  ): Promise<ListingVerificationResponseDto> {
    const isAdmin = await this.isUserAdmin(adminId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can review verifications');
    }

    const verification = await this.prisma.listingVerification.findUnique({
      where: { id: verificationId },
      include: {
        property: true,
        landlord: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.status !== ListingVerificationStatus.PENDING) {
      throw new BadRequestException('Verification already reviewed');
    }

    const updated = await this.prisma.listingVerification.update({
      where: { id: verificationId },
      data: {
        status,
        rejectionReason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        property: true,
        landlord: true,
      },
    });

    // Notify landlord
    await this.prisma.notification.create({
      data: {
        userId: verification.landlordId,
        type: NotificationType.LISTING_VERIFICATION_REVIEWED,
        title: `Listing Verification ${status}`,
        message: status === ListingVerificationStatus.APPROVED
          ? 'Your listing verification has been approved!'
          : `Your listing verification has been rejected: ${rejectionReason || 'No reason provided'}`,
        data: { verificationId, status, rejectionReason },
      },
    });

    return this.mapToResponse(updated);
  }

  async getPendingVerifications(): Promise<ListingVerificationResponseDto[]> {
    const verifications = await this.prisma.listingVerification.findMany({
      where: { status: ListingVerificationStatus.PENDING },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return verifications.map((v) => this.mapToResponse(v));
  }

  private async generatePerceptualHash(documentUrl: string): Promise<string | null> {
    // TODO: Implement perceptual hash generation
    // For now, return a simple hash of the URL
    // In production, this should use image processing libraries
    return null;
  }

  private async isUserAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.name === 'ADMIN' || ur.role.name === 'SUPER_ADMIN');
  }

  private mapToResponse(verification: any): ListingVerificationResponseDto {
    return {
      id: verification.id,
      propertyId: verification.propertyId,
      landlordId: verification.landlordId,
      documentType: verification.documentType,
      documentUrl: verification.documentUrl,
      status: verification.status,
      rejectionReason: verification.rejectionReason,
      reviewedBy: verification.reviewedBy,
      reviewedAt: verification.reviewedAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      property: verification.property ? {
        id: verification.property.id,
        title: verification.property.title,
        addressLine: verification.property.addressLine,
        area: verification.property.area,
        city: verification.property.city,
      } : undefined,
      landlord: verification.landlord ? {
        id: verification.landlord.id,
        fullName: verification.landlord.fullName,
        email: verification.landlord.email,
      } : undefined,
    };
  }
}
