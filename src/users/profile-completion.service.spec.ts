import { describe, expect, it, vi } from 'vitest';
import { ProfileCompletionService } from './profile-completion.service.js';

describe('ProfileCompletionService', () => {
  it('uses the tenant form fields and conditional details in the percentage', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: 'Tenant',
          email: 'tenant@example.com',
          phone: '01700000000',
          avatarUrl: 'avatar.png',
          roles: [{ role: { name: 'TENANT' } }],
          tenantProfile: {
            occupation: 'Engineer',
            maritalStatus: 'SINGLE',
            householdSize: 1,
            hasChildren: true,
            childrenCount: 1,
            youngestChildAge: 2,
            oldestChildAge: 2,
            hasPets: true,
            petType: 'CAT',
            smokingStatus: 'NON_SMOKER',
            returnTimePreference: '18:00',
            gender: 'OTHER',
            bio: 'About me',
            religion: 'Optional religion',
            nationality: 'Optional nationality',
          },
        }),
      },
    };
    const service = new ProfileCompletionService(prisma as any);

    await expect(service.calculateProfileCompletion('tenant-id')).resolves.toBe(100);
  });

  it('does not count default false switches on an otherwise empty tenant profile', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: 'Tenant',
          email: 'tenant@example.com',
          phone: '01700000000',
          avatarUrl: 'avatar.png',
          roles: [{ role: { name: 'TENANT' } }],
          tenantProfile: { hasChildren: false, hasPets: false },
        }),
      },
    };
    const service = new ProfileCompletionService(prisma as any);

    await expect(service.calculateProfileCompletion('tenant-id')).resolves.toBe(27);
  });
});