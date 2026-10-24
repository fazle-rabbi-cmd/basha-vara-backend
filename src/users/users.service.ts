import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto.js';
import { UpdateLandlordProfileDto } from './dto/update-landlord-profile.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        tenantProfile: true,
        landlordProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: user.roles.map((r) => r.role),
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
        roles: true,
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
      roles: updated.roles.map((r) => r.role),
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
}
