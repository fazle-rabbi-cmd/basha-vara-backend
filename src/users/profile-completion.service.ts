import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfileCompletionService {
  constructor(private prisma: PrismaService) {}

  async calculateProfileCompletion(userId: string): Promise<{
    percentage: number;
    completed: string[];
    missing: string[];
  }> {
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
            religion: true,
            nationality: true,
            childrenCount: true,
            youngestChildAge: true,
            oldestChildAge: true,
            petType: true,
          },
        },
        landlordProfile: {
          select: {
            businessName: true,
            contactPreference: true,
            bio: true,
          },
        },
        userDocuments: {
          select: {
            documentType: true,
          },
        },
      },
    });

    if (!user) return { percentage: 0, completed: [], missing: [] };

    // Determine user's primary role
    const primaryRole = user.roles[0]?.role.name?.toLowerCase() || 'tenant';

    if (primaryRole === 'landlord') {
      return this.calculateLandlordCompletion(user);
    } else {
      return this.calculateTenantCompletion(user);
    }
  }

  private calculateTenantCompletion(user: any): {
    percentage: number;
    completed: string[];
    missing: string[];
  } {
    const completed: string[] = [];
    const missing: string[] = [];
    let totalFields = 18; // 4 basic + 12 tenant profile + 2 documents

    // Basic profile fields (set during registration)
    if (user.fullName) completed.push('Full Name');
    else missing.push('Full Name');

    if (user.email) completed.push('Email');
    else missing.push('Email');

    if (user.phone) completed.push('Phone Number');
    else missing.push('Phone Number');

    if (user.avatarUrl) completed.push('Profile Photo');
    else missing.push('Profile Photo');

    // Tenant profile fields (only count if user has provided meaningful data)
    if (user.tenantProfile) {
      const tp = user.tenantProfile;

      // Count meaningful fields (only if not empty/default)
      if (tp.occupation && tp.occupation.trim() !== '') completed.push('Occupation');
      else missing.push('Occupation');

      if (tp.maritalStatus && tp.maritalStatus.trim() !== '') completed.push('Marital Status');
      else missing.push('Marital Status');

      if (tp.householdSize && tp.householdSize > 0) completed.push('Household Size');
      else missing.push('Household Size');

      if (tp.smokingStatus && tp.smokingStatus.trim() !== '') completed.push('Smoking Status');
      else missing.push('Smoking Status');

      if (tp.returnTimePreference && tp.returnTimePreference.trim() !== '') completed.push('Return Time Preference');
      else missing.push('Return Time Preference');

      if (tp.gender && tp.gender.trim() !== '') completed.push('Gender');
      else missing.push('Gender');

      if (tp.bio && tp.bio.trim() !== '') completed.push('Bio');
      else missing.push('Bio');

      if (tp.religion && tp.religion.trim() !== '') completed.push('Religion');
      else missing.push('Religion');

      if (tp.nationality && tp.nationality.trim() !== '') completed.push('Nationality');
      else missing.push('Nationality');

      // Boolean fields: only count if user has provided other profile data
      const hasProfileData =
        (tp.occupation && tp.occupation.trim() !== '') ||
        (tp.maritalStatus && tp.maritalStatus.trim() !== '') ||
        (tp.householdSize && tp.householdSize > 0) ||
        (tp.smokingStatus && tp.smokingStatus.trim() !== '') ||
        (tp.returnTimePreference && tp.returnTimePreference.trim() !== '') ||
        (tp.gender && tp.gender.trim() !== '') ||
        (tp.bio && tp.bio.trim() !== '') ||
        (tp.religion && tp.religion.trim() !== '') ||
        (tp.nationality && tp.nationality.trim() !== '') ||
        tp.hasChildren ||
        tp.hasPets;

      if (hasProfileData) {
        if (tp.hasChildren !== null && tp.hasChildren !== undefined) completed.push('Has Children');
        else missing.push('Has Children');

        if (tp.hasPets !== null && tp.hasPets !== undefined) completed.push('Has Pets');
        else missing.push('Has Pets');
      } else {
        missing.push('Has Children');
        missing.push('Has Pets');
      }

      // Conditional fields for children
      if (tp.hasChildren) {
        totalFields += 3;
        if (tp.childrenCount !== null && tp.childrenCount !== undefined) completed.push('Children Count');
        else missing.push('Children Count');

        if (tp.youngestChildAge !== null && tp.youngestChildAge !== undefined) completed.push('Youngest Child Age');
        else missing.push('Youngest Child Age');

        if (tp.oldestChildAge !== null && tp.oldestChildAge !== undefined) completed.push('Oldest Child Age');
        else missing.push('Oldest Child Age');
      }

      // Conditional field for pets
      if (tp.hasPets) {
        totalFields++;
        if (tp.petType && tp.petType.trim() !== '') completed.push('Pet Type');
        else missing.push('Pet Type');
      }
    } else {
      missing.push('Tenant Details');
    }

    // Documents (Government ID and Proof of Income)
    const documentTypes = user.userDocuments?.map((d: any) => d.documentType) || [];
    const hasGovernmentId = documentTypes.includes('ID');
    const hasProofOfIncome = documentTypes.includes('INCOME');

    if (hasGovernmentId) completed.push('Government ID');
    else missing.push('Government ID');

    if (hasProofOfIncome) completed.push('Proof of Income');
    else missing.push('Proof of Income');

    const percentage = Math.round((completed.length / totalFields) * 100);
    return { percentage, completed, missing };
  }

  private calculateLandlordCompletion(user: any): {
    percentage: number;
    completed: string[];
    missing: string[];
  } {
    const completed: string[] = [];
    const missing: string[] = [];
    const totalFields = 7;

    // Basic profile fields
    if (user.fullName) completed.push('Full Name');
    else missing.push('Full Name');

    if (user.email) completed.push('Email');
    else missing.push('Email');

    if (user.phone) completed.push('Phone Number');
    else missing.push('Phone Number');

    if (user.avatarUrl) completed.push('Profile Photo');
    else missing.push('Profile Photo');

    // Landlord profile fields
    if (user.landlordProfile) {
      if (user.landlordProfile.businessName) completed.push('Business Name');
      else missing.push('Business Name');

      if (user.landlordProfile.contactPreference) completed.push('Contact Preference');
      else missing.push('Contact Preference');

      if (user.landlordProfile.bio) completed.push('Bio');
      else missing.push('Bio');
    } else {
      missing.push('Business Name');
      missing.push('Contact Preference');
      missing.push('Bio');
    }

    const percentage = Math.round((completed.length / totalFields) * 100);
    return { percentage, completed, missing };
  }
}
