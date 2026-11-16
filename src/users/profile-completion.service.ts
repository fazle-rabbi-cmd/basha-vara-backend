import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfileCompletionService {
  constructor(private prisma: PrismaService) {}

  async calculateProfileCompletion(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        tenantProfile: {
          select: {
            occupation: true,
            maritalStatus: true,
            householdSize: true,
            hasChildren: true,
            hasPets: true,
            smokingStatus: true,
            returnTimePreference: true,
            gender: true,
            bio: true,
          },
        },
        landlordProfile: {
          select: {
            businessName: true,
            contactPreference: true,
            bio: true,
          },
        },
      },
    });

    if (!user) return 0;

    // Determine user's primary role
    const primaryRole = user.roles[0]?.role.name?.toLowerCase() || 'tenant';

    if (primaryRole === 'landlord') {
      return this.calculateLandlordCompletion(user);
    } else {
      return this.calculateTenantCompletion(user);
    }
  }

  private calculateTenantCompletion(user: any): number {
    let completedFields = 0;
    let totalFields = 12;

    // Basic profile fields
    if (user.fullName) completedFields++;
    if (user.email) completedFields++;
    if (user.phone) completedFields++;
    if (user.avatarUrl) completedFields++;

    // Tenant profile fields
    if (user.tenantProfile) {
      if (user.tenantProfile.occupation) completedFields++;
      if (user.tenantProfile.maritalStatus) completedFields++;
      if (user.tenantProfile.householdSize) completedFields++;
      if (user.tenantProfile.hasChildren !== null) completedFields++;
      if (user.tenantProfile.hasPets !== null) completedFields++;
      if (user.tenantProfile.smokingStatus) completedFields++;
      if (user.tenantProfile.returnTimePreference) completedFields++;
      if (user.tenantProfile.gender) completedFields++;
      if (user.tenantProfile.bio) completedFields++;
    }

    return Math.round((completedFields / totalFields) * 100);
  }

  private calculateLandlordCompletion(user: any): number {
    let completedFields = 0;
    let totalFields = 7;

    // Basic profile fields
    if (user.fullName) completedFields++;
    if (user.email) completedFields++;
    if (user.phone) completedFields++;
    if (user.avatarUrl) completedFields++;

    // Landlord profile fields
    if (user.landlordProfile) {
      if (user.landlordProfile.businessName) completedFields++;
      if (user.landlordProfile.contactPreference) completedFields++;
      if (user.landlordProfile.bio) completedFields++;
    }

    return Math.round((completedFields / totalFields) * 100);
  }
}
