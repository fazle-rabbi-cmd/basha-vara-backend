import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisitStatus, UserStatus } from '@prisma/client';
import { VisitsService } from './visits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateVisitRequestDto,
  AcceptSlotDto,
  DeclineVisitDto,
  ProposeRescheduleDto,
  RespondRescheduleDto,
  CancelVisitDto,
} from './dto/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';
import { NotificationDigestService } from '../email/notification-digest.service.js';
import { OtpService } from '../common/services/otp.service.js';
import { OtpHasher } from './domain/otp-hasher.js';
import { WorkflowAuditService } from '../common/services/workflow-audit.service.js';
import { IcsGeneratorService } from './services/ics-generator.service.js';
import { VisitDeclineReasonCode } from './domain/visit.types.js';
import { VisitReminderWorker } from './visit-reminder.worker.js';
import { VisitAutoExpireWorker } from './visit-auto-expire.worker.js';
import { TokenHoldWorker } from './token-hold.worker.js';
import { vi } from 'vitest';

describe('VisitsService', () => {
  let service: VisitsService;

  // parseSlotDateTime interprets slot times as Bangladesh time (UTC+6).
  // Shift "now" by +6h so UTC getters produce the correct BD wall-clock time.
  const getBdNow = () => new Date(Date.now() + 6 * 60 * 60 * 1000);

  const mockPrismaService = {
    visitRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    propertyAvailabilityWindow: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    landlordProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockPrismaService)),
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
    generateOtp: vi.fn().mockReturnValue('123456'),
    verifyOtp: vi.fn(),
    getOtpExpiryTime: vi.fn(),
  };

  const mockAuditService = {
    logTransition: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  const mockIcsService = {
    generateIcs: vi.fn().mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
  };

  const mockVisitReminderWorker = {
    scheduleReminders: vi.fn().mockResolvedValue(undefined),
  };

  const mockVisitAutoExpireWorker = {
    scheduleSingleExpire: vi.fn().mockResolvedValue(undefined),
  };

  const mockTokenHoldWorker = {
    scheduleExpiry: vi.fn().mockResolvedValue(undefined),
    handleLandlordSideCancellation: vi.fn().mockResolvedValue(undefined),
    handleTenantWalkaway: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationEmailQueueService, useValue: mockEmailQueueService },
        { provide: NotificationDigestService, useValue: mockDigestService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: WorkflowAuditService, useValue: mockAuditService },
        { provide: IcsGeneratorService, useValue: mockIcsService },
        { provide: VisitReminderWorker, useValue: mockVisitReminderWorker },
        { provide: VisitAutoExpireWorker, useValue: mockVisitAutoExpireWorker },
        { provide: TokenHoldWorker, useValue: mockTokenHoldWorker },
      ],
    }).compile();

    service = module.get<VisitsService>(VisitsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // CREATE VISIT TESTS
  // ==========================================
  describe('create', () => {
    const propertyId = 'prop-1';
    const tenantId = 'tenant-1';
    const futureDate = '2028-12-01';

    it('should successfully create a visit request with proposed candidate slots', async () => {
      const dto: CreateVisitRequestDto = {
        proposedSlots: [
          { date: futureDate, time: '10:00 AM' },
          { date: futureDate, time: '02:00 PM' },
        ],
        message: 'Looking forward to viewing.',
      };

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'landlord-1',
        title: 'Lakeview Flat',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: tenantId,
        fullName: 'Jane Tenant',
        email: 'jane@example.com',
        phone: '+8801700000000',
        status: UserStatus.ACTIVE,
      });
      mockPrismaService.visitRequest.count.mockResolvedValue(0); // 0 active, 0 today
      mockPrismaService.visitRequest.create.mockResolvedValue({
        id: 'visit-1',
        propertyId,
        tenantId,
        status: VisitStatus.REQUESTED,
        requestedDate: new Date('2028-12-01T04:00:00.000Z'),
        requestedTime: '10:00 AM',
        proposedSlots: dto.proposedSlots,
        guestCount: 1,
        property: { id: propertyId, title: 'Lakeview Flat', landlordId: 'landlord-1' },
      });

      const result = await service.create(propertyId, tenantId, dto);

      expect(result).toHaveProperty('id', 'visit-1');
      expect(result.status).toBe(VisitStatus.REQUESTED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          toStatus: 'REQUESTED',
          actorId: tenantId,
          actorRole: 'TENANT',
        }),
      );
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', tenantId, { proposedSlots: [{ date: futureDate, time: '10:00' }] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tenant attempts to book own property', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: tenantId,
      });

      await expect(
        service.create(propertyId, tenantId, { proposedSlots: [{ date: futureDate, time: '10:00' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if active visit request already exists on listing', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'landlord-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: tenantId,
        status: UserStatus.ACTIVE,
        email: 'jane@example.com',
      });
      mockPrismaService.visitRequest.count.mockResolvedValueOnce(1); // active request exists

      await expect(
        service.create(propertyId, tenantId, { proposedSlots: [{ date: futureDate, time: '10:00' }] }),
      ).rejects.toThrow(/already have an active visit request/);
    });

    it('should throw BadRequestException if daily request quota (5) is exceeded', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'landlord-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: tenantId,
        status: UserStatus.ACTIVE,
        email: 'jane@example.com',
      });
      mockPrismaService.visitRequest.count
        .mockResolvedValueOnce(0) // 0 active on this listing
        .mockResolvedValueOnce(5); // 5 created today

      await expect(
        service.create(propertyId, tenantId, { proposedSlots: [{ date: futureDate, time: '10:00' }] }),
      ).rejects.toThrow(/Daily visit request quota reached/);
    });
  });

  // ==========================================
  // ACCEPT SLOT / DOUBLE-BOOKING TESTS
  // ==========================================
  describe('acceptSlot', () => {
    const visitId = 'visit-1';
    const landlordId = 'landlord-1';

    it('should confirm visit slot and write audit log', async () => {
      const dto: AcceptSlotDto = { slotIndex: 0 };
      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        status: VisitStatus.REQUESTED,
        proposedSlots: [{ date: '2028-12-01', time: '10:00' }],
        property: { id: 'prop-1', landlordId },
        tenant: { id: 'tenant-1', fullName: 'Tenant A', email: 'a@example.com' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      mockPrismaService.visitRequest.findMany.mockResolvedValue([]); // No overlapping visits
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...visit,
        status: VisitStatus.CONFIRMED,
        confirmedSlot: { date: '2028-12-01', time: '10:00' },
      });

      const result = await service.acceptSlot(visitId, landlordId, ['LANDLORD'], dto);

      expect(result.status).toBe(VisitStatus.CONFIRMED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          fromStatus: 'REQUESTED',
          toStatus: 'CONFIRMED',
          actorRole: 'LANDLORD',
        }),
      );
    });

    it('should throw BadRequestException on double booking overlap for the listing', async () => {
      const dto: AcceptSlotDto = { slotIndex: 0 };
      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        status: VisitStatus.REQUESTED,
        proposedSlots: [{ date: '2028-12-01', time: '10:00' }],
        property: { id: 'prop-1', landlordId },
        tenant: { id: 'tenant-1' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      // Simulate another confirmed visit at 10:15 on same day (overlapping 45m window)
      mockPrismaService.visitRequest.findMany.mockResolvedValueOnce([
        {
          id: 'other-visit',
          confirmedSlot: { date: '2028-12-01', time: '10:15' },
        },
      ]);

      await expect(service.acceptSlot(visitId, landlordId, ['LANDLORD'], dto)).rejects.toThrow(
        /Double-booking detected/,
      );
    });

    it('should throw ForbiddenException if tenant attempts to accept visit slot', async () => {
      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        status: VisitStatus.REQUESTED,
        property: { id: 'prop-1', landlordId },
      };
      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

      await expect(
        service.acceptSlot(visitId, 'tenant-1', ['TENANT'], { slotIndex: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================
  // DECLINE VISIT TESTS
  // ==========================================
  describe('declineVisit', () => {
    it('should allow landlord to decline visit with reason code', async () => {
      const visitId = 'visit-1';
      const landlordId = 'landlord-1';
      const dto: DeclineVisitDto = {
        reasonCode: VisitDeclineReasonCode.SCHEDULING_CONFLICT,
        reason: 'Away on business trip.',
      };

      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        status: VisitStatus.REQUESTED,
        property: { id: 'prop-1', landlordId, title: 'Flat A' },
        tenant: { id: 'tenant-1', fullName: 'Jane' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...visit,
        status: VisitStatus.DECLINED,
        declineReasonCode: dto.reasonCode,
        declineReason: dto.reason,
      });

      const result = await service.declineVisit(visitId, landlordId, ['LANDLORD'], dto);

      expect(result.status).toBe(VisitStatus.DECLINED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          fromStatus: 'REQUESTED',
          toStatus: 'DECLINED',
          reason: VisitDeclineReasonCode.SCHEDULING_CONFLICT,
        }),
      );
    });
  });

  // ==========================================
  // RESCHEDULE TESTS
  // ==========================================
  describe('proposeReschedule & respondReschedule', () => {
    const visitId = 'visit-1';
    const landlordId = 'landlord-1';
    const tenantId = 'tenant-1';

    it('should allow landlord to propose reschedule and update to RESCHEDULE_PROPOSED', async () => {
      const dto: ProposeRescheduleDto = {
        date: '2028-12-05',
        time: '15:00',
        reason: 'Renovation taking place.',
      };

      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId,
        status: VisitStatus.REQUESTED,
        property: { id: 'prop-1', landlordId, title: 'Flat A' },
        tenant: { id: tenantId, fullName: 'Jane' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...visit,
        status: VisitStatus.RESCHEDULE_PROPOSED,
        rescheduleSlot: { date: dto.date, time: dto.time, proposedBy: 'LANDLORD' },
      });

      const result = await service.proposeReschedule(visitId, landlordId, ['LANDLORD'], dto);

      expect(result.status).toBe(VisitStatus.RESCHEDULE_PROPOSED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          toStatus: 'RESCHEDULE_PROPOSED',
          actorRole: 'LANDLORD',
        }),
      );
    });

    it('should allow tenant to accept reschedule proposal and transition to CONFIRMED', async () => {
      const dto: RespondRescheduleDto = { accept: true };
      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId,
        status: VisitStatus.RESCHEDULE_PROPOSED,
        rescheduleSlot: { date: '2028-12-05', time: '15:00', proposedBy: 'LANDLORD' },
        property: { id: 'prop-1', landlordId, title: 'Flat A' },
        tenant: { id: tenantId, fullName: 'Jane' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      mockPrismaService.visitRequest.findMany.mockResolvedValue([]); // No overlaps
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...visit,
        status: VisitStatus.CONFIRMED,
        confirmedSlot: { date: '2028-12-05', time: '15:00' },
        rescheduleSlot: null,
      });

      const result = await service.respondReschedule(visitId, tenantId, ['TENANT'], dto);

      expect(result.status).toBe(VisitStatus.CONFIRMED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          fromStatus: 'RESCHEDULE_PROPOSED',
          toStatus: 'CONFIRMED',
          actorRole: 'TENANT',
        }),
      );
    });
  });

  // ==========================================
  // CANCEL VISIT & 2H CUTOFF TESTS
  // ==========================================
  describe('cancelVisit', () => {
    it('should allow cancellation outside the 2-hour cutoff window', async () => {
      const visitId = 'visit-1';
      const tenantId = 'tenant-1';
      const dto: CancelVisitDto = { reason: 'Change of plans' };

      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId,
        status: VisitStatus.CONFIRMED,
        confirmedSlot: { date: '2028-12-01', time: '14:00' },
        requestedDate: new Date('2028-12-01T08:00:00.000Z'),
        requestedTime: '14:00',
        property: { id: 'prop-1', landlordId: 'landlord-1', title: 'Flat A' },
        tenant: { id: tenantId, fullName: 'Tenant' },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...visit,
        status: VisitStatus.CANCELLED,
      });

      const result = await service.cancelVisit(visitId, tenantId, ['TENANT'], dto);

      expect(result.status).toBe(VisitStatus.CANCELLED);
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          toStatus: 'CANCELLED',
        }),
      );
    });

    it('should throw BadRequestException if cancelling a confirmed visit within 2-hour cutoff', async () => {
      const visitId = 'visit-1';
      const tenantId = 'tenant-1';

      // Scheduled 30 minutes from now (computed in Dhaka timezone +06:00)
      const now = new Date();
      const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);
      const dhakaTime = new Date(inThirtyMinutes.getTime() + 6 * 60 * 60 * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = dhakaTime.toISOString().split('T')[0];
      const timeStr = `${pad(dhakaTime.getUTCHours())}:${pad(dhakaTime.getUTCMinutes())}`;

      const visit = {
        id: visitId,
        propertyId: 'prop-1',
        tenantId,
        status: VisitStatus.CONFIRMED,
        confirmedSlot: {
          date: dateStr,
          time: timeStr,
        },
        requestedDate: inThirtyMinutes,
        requestedTime: timeStr,
        property: { id: 'prop-1', landlordId: 'landlord-1', title: 'Flat A' },
        tenant: { id: tenantId },
      };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

      await expect(service.cancelVisit(visitId, tenantId, ['TENANT'])).rejects.toThrow(
        /cannot be cancelled less than 2 hours/,
      );
    });
  });

  // ==========================================
  // AUTO EXPIRE TESTS
  // ==========================================
  describe('autoExpireRequests', () => {
    it('should expire requests unresponded for 48 hours and log audit transitions', async () => {
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000);
      const staleVisit = {
        id: 'stale-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        status: VisitStatus.REQUESTED,
        createdAt: oldDate,
        property: { id: 'prop-1', title: 'Old Listing' },
      };

      mockPrismaService.visitRequest.findMany.mockResolvedValue([staleVisit]);
      mockPrismaService.visitRequest.update.mockResolvedValue({
        ...staleVisit,
        status: VisitStatus.EXPIRED,
      });

      const result = await service.autoExpireRequests();

      expect(result.expiredCount).toBe(1);
      expect(result.expiredVisitIds).toContain('stale-1');
      expect(mockAuditService.logTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'VISIT',
          fromStatus: 'REQUESTED',
          toStatus: 'EXPIRED',
          actorRole: 'SYSTEM',
        }),
      );
    });
  });

  // ==========================================
  // AVAILABILITY WINDOWS TESTS
  // ==========================================
  describe('availability windows', () => {
    it('should set weekly availability windows for listing', async () => {
      const propertyId = 'prop-1';
      const landlordId = 'landlord-1';
      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId,
      });
      mockPrismaService.propertyAvailabilityWindow.findMany.mockResolvedValue([
        { id: 'w-1', propertyId, dayOfWeek: 0, startTime: '10:00', endTime: '18:00', isActive: true },
      ]);

      const result = await service.setPropertyAvailability(propertyId, landlordId, ['LANDLORD'], {
        windows: [{ dayOfWeek: 0, startTime: '10:00', endTime: '18:00' }],
      });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.propertyAvailabilityWindow.deleteMany).toHaveBeenCalledWith({
        where: { propertyId },
      });
      expect(mockPrismaService.propertyAvailabilityWindow.createMany).toHaveBeenCalled();
    });
  });

  // ==========================================
  // PHASE 2: VISIT VERIFICATION HARDENING TESTS
  // ==========================================
  describe('Phase 2 - Hardened Verification', () => {
    const visitId = 'visit-1';
    const landlordId = 'landlord-1';
    const tenantId = 'tenant-1';
    const rawOtp = '482910';
    const salt = 'abcdef1234567890abcdef1234567890';
    const otpHashed = OtpHasher.hashOtp(rawOtp, salt);

    describe('getTenantCheckInCode', () => {
      it('should allow tenant to retrieve their check-in display code when window is active', async () => {
        const now = new Date();
        const visit = {
          id: visitId,
          propertyId: 'prop-1',
          tenantId,
          status: VisitStatus.CONFIRMED,
          requestedDate: now,
          requestedTime: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          confirmedSlot: {
            date: now.toISOString().split('T')[0],
            time: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          },
          tenantOtp: rawOtp,
          tenantOtpHashed: otpHashed,
          otpSalt: salt,
          verificationLockedAt: null,
          property: { id: 'prop-1', landlordId },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        const result = await service.getTenantCheckInCode(visitId, tenantId, ['TENANT']);

        expect(result.otp).toBe(rawOtp);
        expect(result.windowOpensAt).toBeDefined();
        expect(result.windowClosesAt).toBeDefined();
      });

      it('should throw ForbiddenException if another user tries to retrieve tenant code', async () => {
        const visit = {
          id: visitId,
          tenantId,
          status: VisitStatus.CONFIRMED,
          property: { landlordId },
        };
        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.getTenantCheckInCode(visitId, 'other-user', ['TENANT']),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw ForbiddenException if visit verification is locked', async () => {
        const visit = {
          id: visitId,
          tenantId,
          status: VisitStatus.CONFIRMED,
          verificationLockedAt: new Date(),
          property: { landlordId },
        };
        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.getTenantCheckInCode(visitId, tenantId, ['TENANT']),
        ).rejects.toThrow(/locked due to excessive failed attempts/);
      });
    });

    describe('verifyCheckIn', () => {
      it('should throw ForbiddenException if tenant attempts self-verification', async () => {
        const visit = {
          id: visitId,
          tenantId,
          status: VisitStatus.CONFIRMED,
          property: { landlordId },
        };
        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.verifyCheckIn(visitId, tenantId, ['TENANT'], { otp: rawOtp }),
        ).rejects.toThrow(/Tenants cannot self-verify visits/);
      });

      it('should allow landlord to verify matching code, awarding IN_PERSON_VERIFIED badge', async () => {
        const now = getBdNow();
        const visit = {
          id: visitId,
          propertyId: 'prop-1',
          tenantId,
          status: VisitStatus.CONFIRMED,
          requestedDate: now,
          requestedTime: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          confirmedSlot: {
            date: now.toISOString().split('T')[0],
            time: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          },
          tenantOtp: rawOtp,
          tenantOtpHashed: otpHashed,
          otpSalt: salt,
          verificationFailedAttempts: 0,
          verificationLockedAt: null,
          property: { id: 'prop-1', landlordId, title: 'Gulshan Flat' },
          tenant: { id: tenantId, fullName: 'Tenant A' },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
        mockPrismaService.visitRequest.update.mockResolvedValue({
          ...visit,
          status: VisitStatus.COMPLETED,
          verificationBadge: 'IN_PERSON_VERIFIED',
          visitVerifiedAt: now,
        });

        const result = await service.verifyCheckIn(visitId, landlordId, ['LANDLORD'], {
          otp: rawOtp,
          latitude: 23.79,
          longitude: 90.41,
        });

        expect(result.status).toBe(VisitStatus.COMPLETED);
        expect(mockAuditService.logTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'VISIT',
            toStatus: 'COMPLETED',
            reason: expect.stringContaining('Landlord verified'),
          }),
        );
      });

      it('should reject incorrect code, incrementing failed attempts', async () => {
        const now = getBdNow();
        const visit = {
          id: visitId,
          propertyId: 'prop-1',
          tenantId,
          status: VisitStatus.CONFIRMED,
          requestedDate: now,
          requestedTime: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          confirmedSlot: {
            date: now.toISOString().split('T')[0],
            time: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          },
          tenantOtp: rawOtp,
          tenantOtpHashed: otpHashed,
          otpSalt: salt,
          verificationFailedAttempts: 2,
          verificationLockedAt: null,
          property: { id: 'prop-1', landlordId },
          tenant: { id: tenantId },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.verifyCheckIn(visitId, landlordId, ['LANDLORD'], { otp: '000000' }),
        ).rejects.toThrow(/Invalid verification code. Remaining attempts: 2/);

        expect(mockPrismaService.visitRequest.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: visitId },
            data: { verificationFailedAttempts: 3 },
          }),
        );
      });

      it('should lock verification on 5th failed attempt and throw ForbiddenException', async () => {
        const now = getBdNow();
        const visit = {
          id: visitId,
          propertyId: 'prop-1',
          tenantId,
          status: VisitStatus.CONFIRMED,
          requestedDate: now,
          requestedTime: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          confirmedSlot: {
            date: now.toISOString().split('T')[0],
            time: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          },
          tenantOtp: rawOtp,
          tenantOtpHashed: otpHashed,
          otpSalt: salt,
          verificationFailedAttempts: 4, // 5th attempt will lock
          verificationLockedAt: null,
          property: { id: 'prop-1', landlordId, title: 'Flat A' },
          tenant: { id: tenantId },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.verifyCheckIn(visitId, landlordId, ['LANDLORD'], { otp: '000000' }),
        ).rejects.toThrow(/maximum failed attempts reached \(5\/5\)\. Visit verification is now locked/);

        expect(mockPrismaService.visitRequest.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: visitId },
            data: expect.objectContaining({
              verificationFailedAttempts: 5,
              verificationLockedAt: expect.any(Date),
            }),
          }),
        );
      });
    });

    describe('confirmVideoCall', () => {
      it('should throw BadRequestException if visit is not a VIDEO_CALL', async () => {
        const visit = {
          id: visitId,
          tenantId,
          visitType: 'IN_PERSON',
          status: VisitStatus.CONFIRMED,
          property: { landlordId },
        };
        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);

        await expect(
          service.confirmVideoCall(visitId, tenantId, ['TENANT']),
        ).rejects.toThrow(/only applicable to video visits/);
      });

      it('should award VIDEO_VERIFIED badge when both parties confirm video call', async () => {
        const visit = {
          id: visitId,
          tenantId,
          visitType: 'VIDEO_CALL',
          status: VisitStatus.CONFIRMED,
          tenantConfirmedCallAt: new Date(), // Tenant already confirmed
          landlordConfirmedCallAt: null,
          property: { landlordId, title: 'Lakeview Apt' },
          tenant: { id: tenantId },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
        mockPrismaService.visitRequest.update.mockResolvedValue({
          ...visit,
          status: VisitStatus.COMPLETED,
          verificationBadge: 'VIDEO_VERIFIED',
          landlordConfirmedCallAt: new Date(),
        });

        const result = await service.confirmVideoCall(visitId, landlordId, ['LANDLORD'], {
          durationMinutes: 20,
        });

        expect(result.status).toBe(VisitStatus.COMPLETED);
        expect(mockAuditService.logTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'VISIT',
            toStatus: 'COMPLETED',
            metadata: expect.objectContaining({ badge: 'VIDEO_VERIFIED' }),
          }),
        );
      });
    });

    describe('reportLandlordNoShow', () => {
      it('should record LANDLORD_NO_SHOW and reduce landlord trust score after window ends', async () => {
        // Scheduled in the past (> 45 mins ago)
        const pastStart = new Date(Date.now() - 60 * 60 * 1000);
        const visit = {
          id: visitId,
          propertyId: 'prop-1',
          tenantId,
          status: VisitStatus.CONFIRMED,
          requestedDate: pastStart,
          requestedTime: `${pastStart.getUTCHours()}:${pastStart.getUTCMinutes()}`,
          property: { id: 'prop-1', landlordId, title: 'Flat B' },
          tenant: { id: tenantId },
        };

        mockPrismaService.visitRequest.findUnique.mockResolvedValue(visit);
        mockPrismaService.visitRequest.update.mockResolvedValue({
          ...visit,
          status: VisitStatus.LANDLORD_NO_SHOW,
          landlordAttended: false,
        });
        mockPrismaService.landlordProfile.findUnique.mockResolvedValue({
          id: 'lp-1',
          userId: landlordId,
          trustScore: 90,
        });

        const result = await service.reportLandlordNoShow(visitId, tenantId, ['TENANT'], {
          reason: 'Landlord did not arrive at property.',
        });

        expect(result.status).toBe(VisitStatus.LANDLORD_NO_SHOW);
        expect(mockPrismaService.landlordProfile.update).toHaveBeenCalledWith({
          where: { id: 'lp-1' },
          data: { trustScore: 80 }, // Decremented by 10 points
        });
        expect(mockAuditService.logTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'VISIT',
            toStatus: 'LANDLORD_NO_SHOW',
            actorRole: 'TENANT',
          }),
        );
      });
    });

    describe('isVerifiedVisitorForListing', () => {
      it('should return true for visits verified within the last 14 days', async () => {
        const verifiedFiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        mockPrismaService.visitRequest.findFirst.mockResolvedValue({
          id: 'visit-verified',
          tenantId,
          propertyId: 'prop-1',
          status: VisitStatus.COMPLETED,
          visitVerifiedAt: verifiedFiveDaysAgo,
        });

        const isValid = await service.isVerifiedVisitorForListing(tenantId, 'prop-1');
        expect(isValid).toBe(true);
      });

      it('should return false if verified visit has expired (> 14 days)', async () => {
        const verifiedTwentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
        mockPrismaService.visitRequest.findFirst.mockResolvedValue({
          id: 'visit-expired',
          tenantId,
          propertyId: 'prop-1',
          status: VisitStatus.COMPLETED,
          visitVerifiedAt: verifiedTwentyDaysAgo,
        });

        const isValid = await service.isVerifiedVisitorForListing(tenantId, 'prop-1');
        expect(isValid).toBe(false);
      });
    });
  });
});
