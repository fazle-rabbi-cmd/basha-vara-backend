import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { VisitsService } from './visits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';
import { NotificationDigestService } from '../email/notification-digest.service.js';
import { OtpService } from '../common/services/otp.service.js';

describe('VisitsService - Additional Tests', () => {
  let service: VisitsService;
  let prisma: any;
  let notificationsService: any;
  let emailQueueService: any;
  let digestService: any;
  let otpService: any;

  beforeEach(async () => {
    const mockPrisma = {
      visitRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      property: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      payment: {
        create: vi.fn(),
      },
      escrow: {
        create: vi.fn(),
      },
    };

    const mockNotificationsService = {
      create: vi.fn(),
    };

    const mockEmailQueueService = {
      queueNotificationEmail: vi.fn(),
    };

    const mockDigestService = {
      queueForDigest: vi.fn(),
    };

    const mockOtpService = {
      generateOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getOtpExpiryTime: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: NotificationEmailQueueService,
          useValue: mockEmailQueueService,
        },
        {
          provide: NotificationDigestService,
          useValue: mockDigestService,
        },
        {
          provide: OtpService,
          useValue: mockOtpService,
        },
      ],
    }).compile();

    service = module.get<VisitsService>(VisitsService);
    prisma = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);
    emailQueueService = module.get(NotificationEmailQueueService);
    digestService = module.get(NotificationDigestService);
    otpService = module.get(OtpService);
  });

  describe('findTenantVisits', () => {
    it('should return visits for a tenant', async () => {
      const mockVisits = [
        {
          id: 'visit-1',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          requestedDate: new Date(),
          requestedTime: '10:00',
          status: 'PENDING',
          visitType: 'IN_PERSON',
          guestCount: 1,
          contactPhone: null,
          message: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          property: {
            id: 'prop-1',
            title: 'Test Property',
            addressLine: '123 Test St',
            area: 'Dhanmondi',
            city: 'Dhaka',
            rentAmount: 25000,
            photos: [],
            landlord: {
              id: 'landlord-1',
              fullName: 'Test Landlord',
              email: 'landlord@test.com',
              phone: '01712345678',
            },
          },
        },
      ];

      prisma.visitRequest.findMany.mockResolvedValue(mockVisits);

      const result = await service.findTenantVisits('tenant-1');

      expect(result).toEqual(mockVisits);
      expect(prisma.visitRequest.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              addressLine: true,
              area: true,
              city: true,
              rentAmount: true,
              photos: { take: 1 },
              landlord: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });
    });
  });

  describe('findLandlordVisits', () => {
    it('should return visits for landlord properties', async () => {
      const mockVisits = [
        {
          id: 'visit-1',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          requestedDate: new Date(),
          requestedTime: '10:00',
          status: 'PENDING',
          visitType: 'IN_PERSON',
          guestCount: 1,
          contactPhone: null,
          message: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tenant: {
            id: 'tenant-1',
            fullName: 'Test Tenant',
            email: 'tenant@test.com',
            phone: '01712345678',
            avatarUrl: null,
            tenantProfile: null,
          },
          property: {
            id: 'prop-1',
            title: 'Test Property',
            addressLine: '123 Test St',
            area: 'Dhanmondi',
            city: 'Dhaka',
            rentAmount: 25000,
            photos: [],
          },
        },
      ];

      prisma.visitRequest.findMany.mockResolvedValue(mockVisits);

      const result = await service.findLandlordVisits('landlord-1');

      expect(result).toEqual(mockVisits);
      expect(prisma.visitRequest.findMany).toHaveBeenCalledWith({
        where: {
          property: {
            landlordId: 'landlord-1',
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              tenantProfile: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
              addressLine: true,
              area: true,
              city: true,
              rentAmount: true,
              photos: { take: 1 },
            },
          },
        },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update visit status as landlord', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'PENDING',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      const updatedVisit = { ...mockVisit, status: 'CONFIRMED' };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      prisma.visitRequest.update.mockResolvedValue(updatedVisit);

      const result = await service.updateStatus('visit-1', 'landlord-1', ['LANDLORD'], {
        status: 'CONFIRMED',
      } as any);

      expect(result).toEqual(updatedVisit);
      expect(prisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'visit-1' },
        data: { status: 'CONFIRMED' },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              area: true,
            },
          },
          tenant: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException for non-existent visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('visit-1', 'user-1', ['TENANT'], {
        status: 'CANCELLED',
      } as any)).rejects.toThrow('Visit request with ID visit-1 not found');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'PENDING',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.updateStatus('visit-1', 'other-user', ['TENANT'], {
        status: 'CANCELLED',
      } as any)).rejects.toThrow('You do not have permission to modify this visit request');
    });
  });

  describe('generateOtp', () => {
    it('should generate OTP for visit verification', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      otpService.generateOtp.mockReturnValue('123456');
      prisma.visitRequest.update.mockResolvedValue({ ...mockVisit, otpCode: '123456' });

      const result = await service.generateOtp('visit-1', 'tenant-1', 'tenant');

      expect(result).toHaveProperty('otp');
      expect(otpService.generateOtp).toHaveBeenCalledWith(`visit-1-tenant`);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      otpService.verifyOtp.mockReturnValue(true);
      prisma.visitRequest.update.mockResolvedValue({ ...mockVisit, tenantOtpVerifiedAt: new Date() });

      const result = await service.verifyOtp('visit-1', 'tenant-1', 'tenant', '123456');

      expect(result).toHaveProperty('tenantOtpVerifiedAt');
      expect(otpService.verifyOtp).toHaveBeenCalledWith(`visit-1-tenant`, '123456');
    });

    it('should reject invalid OTP', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      otpService.verifyOtp.mockReturnValue(false);

      await expect(service.verifyOtp('visit-1', 'tenant-1', 'tenant', '000000'))
        .rejects.toThrow('Invalid or expired OTP');
    });
  });

  describe('completeVisit', () => {
    it('should complete visit when both OTPs verified', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        landlordOtpVerifiedAt: new Date(),
        tenantOtpVerifiedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      const updatedVisit = {
        ...mockVisit,
        status: 'COMPLETED',
        visitVerifiedAt: new Date(),
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      prisma.visitRequest.update.mockResolvedValue(updatedVisit);

      const result = await service.completeVisit('visit-1', 'landlord-1');

      expect(result).toEqual(updatedVisit);
      expect(prisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'visit-1' },
        data: {
          status: 'COMPLETED',
          visitVerifiedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if OTPs not verified', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        landlordOtpVerifiedAt: null,
        tenantOtpVerifiedAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.completeVisit('visit-1', 'landlord-1'))
        .rejects.toThrow('Both parties must verify OTP before completing visit');
    });
  });

  describe('initiateTokenHold', () => {
    it('should initiate token hold for accepted visit', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenHoldAmount: null,
        tokenHoldExpiresAt: null,
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      const updatedVisit = {
        ...mockVisit,
        tokenHoldAmount: 5000,
        tokenHoldExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      prisma.visitRequest.update.mockResolvedValue(updatedVisit);
      prisma.property.update.mockResolvedValue({
        id: 'prop-1',
        lockedByVisitId: 'visit-1',
        lockedUntil: updatedVisit.tokenHoldExpiresAt,
      });

      const result = await service.initiateTokenHold('visit-1', 'tenant-1', 5000);

      expect(result).toEqual(updatedVisit);
      expect(prisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'visit-1' },
        data: {
          tokenHoldAmount: 5000,
          tokenHoldExpiresAt: expect.any(Date),
        },
      });
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: {
          lockedByVisitId: 'visit-1',
          lockedUntil: expect.any(Date),
        },
      });
    });

    it('should throw error if token hold already exists', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenHoldAmount: 5000,
        tokenHoldExpiresAt: new Date(),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.initiateTokenHold('visit-1', 'tenant-1', 5000))
        .rejects.toThrow('Token hold already initiated for this visit');
    });

    it('should throw NotFoundException for non-existent visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(null);

      await expect(service.initiateTokenHold('visit-1', 'tenant-1', 5000))
        .rejects.toThrow('Visit not found');
    });

    it('should throw ForbiddenException for non-tenant', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        status: 'ACCEPTED',
        tokenHoldAmount: null,
        property: { id: 'prop-1', landlordId: 'landlord-1' },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.initiateTokenHold('visit-1', 'other-user', 5000))
        .rejects.toThrow('Only tenant can initiate token hold');
    });

    it('should throw BadRequestException for non-accepted visit', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        status: 'PENDING',
        tokenHoldAmount: null,
        property: { id: 'prop-1', landlordId: 'landlord-1' },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.initiateTokenHold('visit-1', 'tenant-1', 5000))
        .rejects.toThrow('Token hold can only be initiated for accepted visits');
    });
  });

  describe('lockProperty', () => {
    it('should lock property for landlord', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenHoldAmount: 5000,
        tokenHoldExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      const updatedProperty = {
        id: 'prop-1',
        lockedByVisitId: 'visit-1',
        lockedUntil: mockVisit.tokenHoldExpiresAt,
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);
      prisma.property.update.mockResolvedValue(updatedProperty);

      const result = await service.lockProperty('visit-1', 'landlord-1');

      expect(result).toEqual(updatedProperty);
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: {
          lockedByVisitId: 'visit-1',
          lockedUntil: mockVisit.tokenHoldExpiresAt,
        },
      });
    });

    it('should throw error if token hold not initiated', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        requestedDate: new Date(),
        requestedTime: '10:00',
        status: 'ACCEPTED',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenHoldAmount: null,
        tokenHoldExpiresAt: null,
        property: {
          id: 'prop-1',
          title: 'Test Property',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.lockProperty('visit-1', 'landlord-1'))
        .rejects.toThrow('Token hold must be initiated before locking property');
    });

    it('should throw NotFoundException for non-existent visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(null);

      await expect(service.lockProperty('visit-1', 'landlord-1'))
        .rejects.toThrow('Visit not found');
    });

    it('should throw ForbiddenException for non-landlord', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        tokenHoldAmount: 5000,
        tokenHoldExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        property: {
          id: 'prop-1',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.lockProperty('visit-1', 'other-user'))
        .rejects.toThrow('Only landlord can lock property');
    });

    it('should throw BadRequestException for expired token hold', async () => {
      const mockVisit = {
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        tokenHoldAmount: 5000,
        tokenHoldExpiresAt: new Date(Date.now() - 1000), // Expired
        property: {
          id: 'prop-1',
          landlordId: 'landlord-1',
        },
      };

      prisma.visitRequest.findUnique.mockResolvedValue(mockVisit);

      await expect(service.lockProperty('visit-1', 'landlord-1'))
        .rejects.toThrow('Token hold has expired');
    });
  });

  describe('unlockProperty', () => {
    it('should unlock expired property lock', async () => {
      const mockProperty = {
        id: 'prop-1',
        lockedByVisitId: 'visit-1',
        lockedUntil: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.property.update.mockResolvedValue({
        ...mockProperty,
        lockedByVisitId: null,
        lockedUntil: null,
      });

      const result = await service.unlockProperty('prop-1');

      expect(result).toEqual({ unlocked: true });
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: {
          lockedByVisitId: null,
          lockedUntil: null,
        },
      });
    });

    it('should throw error for non-existent property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(service.unlockProperty('prop-1'))
        .rejects.toThrow('Property not found');
    });
  });
});
