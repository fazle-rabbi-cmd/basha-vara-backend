import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { VisitsService } from './visits.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVisitRequestDto } from './dto/create-visit-request.dto.js';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';
import { NotificationDigestService } from '../email/notification-digest.service.js';
import { OtpService } from '../common/services/otp.service.js';
import { vi } from 'vitest';

describe('VisitsService', () => {
  let service: VisitsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    visitRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    property: {
      findUnique: vi.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a visit request', async () => {
      const propertyId = 'prop-1';
      const tenantId = 'tenant-1';
      const dto: CreateVisitRequestDto = {
        requestedDate: new Date('2026-12-01'),
        requestedTime: '10:00 AM',
      };

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'landlord-1',
      });
      mockPrismaService.visitRequest.findFirst.mockResolvedValue(null);
      mockPrismaService.visitRequest.create.mockResolvedValue({
        id: 'visit-1',
        propertyId,
        tenantId,
        status: VisitStatus.PENDING,
        requestedDate: new Date('2026-12-01'),
        requestedTime: '10:00 AM',
        visitType: 'IN_PERSON',
        guestCount: 1,
        contactPhone: null,
        message: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        property: { id: propertyId, title: 'Test Property' },
      });

      const result = await service.create(propertyId, tenantId, dto);

      expect(result).toHaveProperty('id', 'visit-1');
      expect(result.status).toBe(VisitStatus.PENDING);
    });

    it('should throw NotFoundException for non-existent property', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(service.create('nonexistent', 'tenant-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for own property', async () => {
      const propertyId = 'prop-1';
      const tenantId = 'landlord-1';

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: tenantId,
      });

      await expect(service.create(propertyId, tenantId, {} as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate pending request', async () => {
      const propertyId = 'prop-1';
      const tenantId = 'tenant-1';

      mockPrismaService.property.findUnique.mockResolvedValue({
        id: propertyId,
        landlordId: 'landlord-1',
      });
      mockPrismaService.visitRequest.findFirst.mockResolvedValue({
        id: 'visit-1',
        status: VisitStatus.PENDING,
      });

      await expect(service.create(propertyId, tenantId, {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findTenantVisits', () => {
    it('should return all visits for tenant', async () => {
      const tenantId = 'tenant-1';
      mockPrismaService.visitRequest.findMany.mockResolvedValue([
        {
          id: 'visit-1',
          tenantId,
          status: VisitStatus.PENDING,
          property: { id: 'prop-1', title: 'Test Property' },
        },
      ]);

      const result = await service.findTenantVisits(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'visit-1');
    });
  });

  describe('findLandlordVisits', () => {
    it('should return all visits for landlord properties', async () => {
      const landlordId = 'landlord-1';
      mockPrismaService.visitRequest.findMany.mockResolvedValue([
        {
          id: 'visit-1',
          tenantId: 'tenant-1',
          status: VisitStatus.PENDING,
          property: { id: 'prop-1', title: 'Test Property', landlordId },
          tenant: { id: 'tenant-1', fullName: 'Tenant' },
        },
      ]);

      const result = await service.findLandlordVisits(landlordId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'visit-1');
    });
  });

  describe('updateStatus', () => {
    it('should allow landlord to approve visit', async () => {
      const visitId = 'visit-1';
      const userId = 'landlord-1';
      const dto: UpdateVisitStatusDto = { status: VisitStatus.ACCEPTED };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue({
        id: visitId,
        tenantId: 'tenant-1',
        status: VisitStatus.PENDING,
        property: { landlordId: userId },
      });
      mockPrismaService.visitRequest.update.mockResolvedValue({
        id: visitId,
        status: VisitStatus.APPROVED,
        requestedDate: new Date('2026-12-01'),
        requestedTime: '10:00 AM',
        property: { title: 'Test Property' },
        tenant: { id: 'tenant-1', fullName: 'Test Tenant' },
      });

      const result = await service.updateStatus(visitId, userId, ['LANDLORD'], dto);

      expect(result.status).toBe(VisitStatus.APPROVED);
    });

    it('should allow tenant to cancel visit', async () => {
      const visitId = 'visit-1';
      const userId = 'tenant-1';
      const dto: UpdateVisitStatusDto = { status: VisitStatus.CANCELLED };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue({
        id: visitId,
        tenantId: userId,
        status: VisitStatus.PENDING,
        property: { landlordId: 'landlord-1' },
      });
      mockPrismaService.visitRequest.update.mockResolvedValue({
        id: visitId,
        status: VisitStatus.CANCELLED,
        requestedDate: new Date('2026-12-01'),
        requestedTime: '10:00 AM',
        property: { title: 'Test Property' },
        tenant: { id: 'tenant-1', fullName: 'Test Tenant' },
      });

      const result = await service.updateStatus(visitId, userId, ['TENANT'], dto);

      expect(result.status).toBe(VisitStatus.CANCELLED);
    });

    it('should allow admin to update any visit', async () => {
      const visitId = 'visit-1';
      const userId = 'admin-1';
      const dto: UpdateVisitStatusDto = { status: VisitStatus.ACCEPTED };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue({
        id: visitId,
        tenantId: 'tenant-1',
        status: VisitStatus.PENDING,
        property: { landlordId: 'landlord-1' },
      });
      mockPrismaService.visitRequest.update.mockResolvedValue({
        id: visitId,
        status: VisitStatus.APPROVED,
        requestedDate: new Date('2026-12-01'),
        requestedTime: '10:00 AM',
        property: { title: 'Test Property' },
        tenant: { id: 'tenant-1', fullName: 'Test Tenant' },
      });

      const result = await service.updateStatus(visitId, userId, ['ADMIN'], dto);

      expect(result.status).toBe(VisitStatus.APPROVED);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const visitId = 'visit-1';
      const userId = 'user-1';
      const dto: UpdateVisitStatusDto = { status: VisitStatus.ACCEPTED };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue({
        id: visitId,
        tenantId: 'tenant-1',
        status: VisitStatus.PENDING,
        property: { landlordId: 'landlord-1' },
      });

      await expect(service.updateStatus(visitId, userId, ['TENANT'], dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for tenant trying to approve', async () => {
      const visitId = 'visit-1';
      const userId = 'tenant-1';
      const dto: UpdateVisitStatusDto = { status: VisitStatus.ACCEPTED };

      mockPrismaService.visitRequest.findUnique.mockResolvedValue({
        id: visitId,
        tenantId: userId,
        status: VisitStatus.PENDING,
        property: { landlordId: 'landlord-1' },
      });

      await expect(service.updateStatus(visitId, userId, ['TENANT'], dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent visit', async () => {
      mockPrismaService.visitRequest.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent', 'user-1', ['TENANT'], {} as any)).rejects.toThrow(NotFoundException);
    });
  });
});
