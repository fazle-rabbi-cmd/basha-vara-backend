import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto.js';
import { UpdateLandlordProfileDto } from './dto/update-landlord-profile.dto.js';
import { UpdateContactPrivacyDto } from './dto/update-contact-privacy.dto.js';
import { Prisma, ContactVisibility } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (!phone) return phone;
    if (phone.length <= 4) return phone;
    return phone.replace(/(\+\d{3})\d+(\d{4})$/, '$1****$2');
  }

  private getContactVisibilitySetting(
    visibility: ContactVisibility,
    defaultValue: string,
  ): string {
    if (visibility === 'FULL') return defaultValue;
    if (visibility === 'MASKED') {
      if (defaultValue.includes('@')) return this.maskEmail(defaultValue);
      return this.maskPhone(defaultValue);
    }
    return this.maskEmail(defaultValue.includes('@') ? defaultValue : this.maskPhone(defaultValue));
  }

  async getUserById(userId: string, requestingUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwnProfile = requestingUserId === userId;

    const email = isOwnProfile
      ? user.email
      : this.getContactVisibilitySetting(user.emailVisibility, user.email);

    const phone = user.phone
      ? isOwnProfile
        ? user.phone
        : this.getContactVisibilitySetting(user.phoneVisibility, user.phone)
      : null;

    return {
      id: user.id,
      email,
      fullName: user.fullName,
      phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVisibility: user.emailVisibility,
      phoneVisibility: user.phoneVisibility,
      revealContactAfterMilestone: user.revealContactAfterMilestone,
      roles: user.roles.map((r) => r.role.name),
      tenantProfile: user.tenantProfile,
      landlordProfile: user.landlordProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getPublicProfile(userId: string, requestingUser?: { id: string; roles?: string[] } | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        tenantProfile: true,
        landlordProfile: true,
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwnProfile = requestingUser?.id === userId;
    const roles = user.roles.map((r) => r.role.name);
    const isLandlord = roles.includes('LANDLORD');
    const isTenant = roles.includes('TENANT');

    // Return limited public info
    const publicProfile: any = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      roles,
      createdAt: user.createdAt,
      // Member since (years on platform)
      memberSince: this.getMemberSince(user.createdAt),
    };

    // Add role-specific public info
    if (isLandlord && user.landlordProfile) {
      publicProfile.landlordInfo = {
        businessName: user.landlordProfile.businessName,
        bio: user.landlordProfile.bio,
        propertyCount: user._count.properties,
        contactPreference: user.landlordProfile.contactPreference,
      };
    }

    // Tenant details (occupation, budget, household) are only visible to
    // landlords/admins or the tenant themselves — never to anonymous visitors
    const requesterRoles = requestingUser?.roles ?? [];
    const canViewTenantDetails =
      isOwnProfile ||
      requesterRoles.some((r) =>
        ['LANDLORD', 'ADMIN', 'SUPER_ADMIN'].includes(r),
      );

    if (isTenant && user.tenantProfile && canViewTenantDetails) {
      publicProfile.tenantInfo = {
        occupation: user.tenantProfile.occupation,
        householdSize: user.tenantProfile.householdSize,
        bio: user.tenantProfile.bio,
        budgetMin: user.tenantProfile.budgetMin?.toString(),
        budgetMax: user.tenantProfile.budgetMax?.toString(),
        religion: user.tenantProfile.religion,
        nationality: user.tenantProfile.nationality,
      };
    }

    // Contact info is NEVER returned via public profile endpoint
    // Use existing milestone-based contact reveal instead

    return publicProfile;
  }

  private getMemberSince(createdAt: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffYears = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365));

    if (diffYears < 1) {
      const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      return diffMonths === 1 ? '1 month' : `${diffMonths} months`;
    }
    return diffYears === 1 ? '1 year' : `${diffYears} years`;
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl.trim() }),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      status: updated.status,
      roles: updated.roles.map((r) => r.role.name),
      tenantProfile: updated.tenantProfile,
      landlordProfile: updated.landlordProfile,
    };
  }

  async updateTenantProfile(userId: string, dto: UpdateTenantProfileDto) {
    const tenantProfile = await this.prisma.tenantProfile.upsert({
      where: { userId },
      create: {
        userId,
        occupation: dto.occupation,
        moveInDatePreference: dto.moveInDatePreference,
        householdSize: dto.householdSize,
        preferredLocations: dto.preferredLocations ?? [],
        budgetMin: dto.budgetMin !== undefined ? new Prisma.Decimal(dto.budgetMin) : null,
        budgetMax: dto.budgetMax !== undefined ? new Prisma.Decimal(dto.budgetMax) : null,
        preferredPropertyTypes: dto.preferredPropertyTypes ?? [],
        bio: dto.bio,
        religion: dto.religion,
        nationality: dto.nationality,
      },
      update: {
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.moveInDatePreference !== undefined && { moveInDatePreference: dto.moveInDatePreference }),
        ...(dto.householdSize !== undefined && { householdSize: dto.householdSize }),
        ...(dto.preferredLocations !== undefined && { preferredLocations: dto.preferredLocations }),
        ...(dto.budgetMin !== undefined && { budgetMin: new Prisma.Decimal(dto.budgetMin) }),
        ...(dto.budgetMax !== undefined && { budgetMax: new Prisma.Decimal(dto.budgetMax) }),
        ...(dto.preferredPropertyTypes !== undefined && { preferredPropertyTypes: dto.preferredPropertyTypes }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.religion !== undefined && { religion: dto.religion }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
      },
    });

    return tenantProfile;
  }

  async updateLandlordProfile(userId: string, dto: UpdateLandlordProfileDto) {
    const landlordProfile = await this.prisma.landlordProfile.upsert({
      where: { userId },
      create: {
        userId,
        businessName: dto.businessName,
        contactPreference: dto.contactPreference,
        bio: dto.bio,
      },
      update: {
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.contactPreference !== undefined && { contactPreference: dto.contactPreference }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });

    return landlordProfile;
  }

  async updateContactPrivacy(userId: string, dto: UpdateContactPrivacyDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.emailVisibility !== undefined && { emailVisibility: dto.emailVisibility }),
        ...(dto.phoneVisibility !== undefined && { phoneVisibility: dto.phoneVisibility }),
        ...(dto.revealContactAfterMilestone !== undefined && { revealContactAfterMilestone: dto.revealContactAfterMilestone }),
      },
      select: {
        emailVisibility: true,
        phoneVisibility: true,
        revealContactAfterMilestone: true,
      },
    });

    return updated;
  }
}
