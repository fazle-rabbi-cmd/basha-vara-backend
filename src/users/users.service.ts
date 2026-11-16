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
