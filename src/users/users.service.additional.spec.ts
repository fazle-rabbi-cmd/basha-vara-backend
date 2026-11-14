import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService - Additional Tests', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tenantProfile: {
        upsert: vi.fn(),
      },
      landlordProfile: {
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateContactPrivacy', () => {
    it('should update email visibility', async () => {
      const mockUser = {
        emailVisibility: 'VISIBLE',
        phoneVisibility: 'MASKED',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
      };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateContactPrivacy('user-1', {
        emailVisibility: 'VISIBLE',
      } as any);

      expect(result.emailVisibility).toBe('VISIBLE');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVisibility: 'VISIBLE' },
        select: {
          emailVisibility: true,
          phoneVisibility: true,
          revealContactAfterMilestone: true,
        },
      });
    });

    it('should update phone visibility', async () => {
      const mockUser = {
        emailVisibility: 'MASKED',
        phoneVisibility: 'VISIBLE',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
      };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateContactPrivacy('user-1', {
        phoneVisibility: 'VISIBLE',
      } as any);

      expect(result.phoneVisibility).toBe('VISIBLE');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { phoneVisibility: 'VISIBLE' },
        select: {
          emailVisibility: true,
          phoneVisibility: true,
          revealContactAfterMilestone: true,
        },
      });
    });

    it('should update reveal contact milestone', async () => {
      const mockUser = {
        emailVisibility: 'MASKED',
        phoneVisibility: 'MASKED',
        revealContactAfterMilestone: 'LEASE_SIGNED',
      };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateContactPrivacy('user-1', {
        revealContactAfterMilestone: 'LEASE_SIGNED',
      } as any);

      expect(result.revealContactAfterMilestone).toBe('LEASE_SIGNED');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { revealContactAfterMilestone: 'LEASE_SIGNED' },
        select: {
          emailVisibility: true,
          phoneVisibility: true,
          revealContactAfterMilestone: true,
        },
      });
    });

    it('should update multiple fields at once', async () => {
      const mockUser = {
        emailVisibility: 'VISIBLE',
        phoneVisibility: 'VISIBLE',
        revealContactAfterMilestone: 'VISIT_COMPLETED',
      };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateContactPrivacy('user-1', {
        emailVisibility: 'VISIBLE',
        phoneVisibility: 'VISIBLE',
        revealContactAfterMilestone: 'VISIT_COMPLETED',
      } as any);

      expect(result.emailVisibility).toBe('VISIBLE');
      expect(result.phoneVisibility).toBe('VISIBLE');
      expect(result.revealContactAfterMilestone).toBe('VISIT_COMPLETED');
    });

    it('should handle partial updates', async () => {
      const mockUser = {
        emailVisibility: 'MASKED',
        phoneVisibility: 'VISIBLE',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
      };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateContactPrivacy('user-1', {
        phoneVisibility: 'VISIBLE',
      } as any);

      expect(result.phoneVisibility).toBe('VISIBLE');
      expect(result.emailVisibility).toBe('MASKED'); // Unchanged
    });
  });

  describe('getUserById contact masking', () => {
    const baseUser = {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User',
      phone: '01712345678',
      avatarUrl: null,
      status: 'ACTIVE',
      emailVisibility: 'MASKED',
      phoneVisibility: 'MASKED',
      revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
      roles: [{ role: { name: 'TENANT' } }],
      tenantProfile: null,
      landlordProfile: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return full contact for own profile', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getUserById('user-1', 'user-1');

      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBe('01712345678');
    });

    it('should mask email and phone for other users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: '+8801712345678',
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.email).not.toBe('test@example.com');
      expect(result.email).toContain('@');
      expect(result.phone).not.toBe('+8801712345678');
      expect(result.phone).toContain('****');
    });

    it('should handle short email local part', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        email: 'ab@example.com',
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.email).toBe('a***@example.com');
    });

    it('should return full contact when visibility is FULL', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        emailVisibility: 'FULL',
        phoneVisibility: 'FULL',
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBe('01712345678');
    });

    it('should mask contact when visibility is PLATFORM_ONLY', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: '+8801712345678',
        emailVisibility: 'PLATFORM_ONLY',
        phoneVisibility: 'PLATFORM_ONLY',
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.email).not.toBe('test@example.com');
      expect(result.phone).not.toBe('+8801712345678');
    });

    it('should return null phone when user has no phone', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: null,
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.phone).toBeNull();
    });

    it('should handle short phone in masking', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        phone: '123',
      });

      const result = await service.getUserById('user-1', 'other-user');

      expect(result.phone).toBe('123');
    });
  });

  describe('getUserById edge cases', () => {
    it('should handle user with multiple roles', async () => {
      const userId = 'user-1';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '01712345678',
        avatarUrl: null,
        status: 'ACTIVE',
        emailVisibility: 'MASKED',
        phoneVisibility: 'MASKED',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
        roles: [
          { role: { name: 'TENANT' } },
          { role: { name: 'LANDLORD' } },
        ],
        tenantProfile: { id: 'tenant-1' },
        landlordProfile: { id: 'landlord-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getUserById(userId);

      expect(result.roles).toContain('TENANT');
      expect(result.roles).toContain('LANDLORD');
    });

    it('should handle user with no roles', async () => {
      const userId = 'user-1';
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        fullName: 'Test User',
        phone: '01712345678',
        avatarUrl: null,
        status: 'ACTIVE',
        emailVisibility: 'MASKED',
        phoneVisibility: 'MASKED',
        revealContactAfterMilestone: 'APPLICATION_SHORTLISTED',
        roles: [],
        tenantProfile: null,
        landlordProfile: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getUserById(userId);

      expect(result.roles).toEqual([]);
    });
  });
});
