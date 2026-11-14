import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, PropertyStatus, VisitStatus } from '@prisma/client';
import { ApplicationsService } from './applications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEmailQueueService } from '../email/notification-email-queue.service.js';
import { NotificationDigestService } from '../email/notification-digest.service.js';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: any;
  let notificationsService: any;
  let emailQueueService: any;
  let digestService: any;

  const mockProperty = {
    id: 'prop-1',
    title: 'Test Property',
    landlordId: 'landlord-1',
    status: PropertyStatus.PUBLISHED,
  };

  const mockApplication = {
    id: 'app-1',
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    status: ApplicationStatus.SUBMITTED,
    property: mockProperty,
    tenant: { id: 'tenant-1', fullName: 'Test Tenant', email: 't@e.com' },
  };

  beforeEach(async () => {
    const mockPrisma = {
      property: { findUnique: vi.fn() },
      rentalApplication: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      visitRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: { create: vi.fn() } },
        { provide: NotificationEmailQueueService, useValue: { queueNotificationEmail: vi.fn() } },
        { provide: NotificationDigestService, useValue: { queueForDigest: vi.fn() } },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prisma = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);
    emailQueueService = module.get(NotificationEmailQueueService);
    digestService = module.get(NotificationDigestService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create', () => {
    const dto = { coverNote: '  Hello  ', moveInDate: new Date('2025-02-01') };

    it('creates an application and notifies landlord', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue(null);
      prisma.rentalApplication.create.mockResolvedValue(mockApplication);
      prisma.user.findUnique.mockResolvedValue({ fullName: 'Tenant Name' });

      const result = await service.create('prop-1', 'tenant-1', dto as any);

      expect(result).toEqual(mockApplication);
      expect(prisma.rentalApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            propertyId: 'prop-1',
            tenantId: 'tenant-1',
            coverNote: 'Hello',
            status: ApplicationStatus.SUBMITTED,
          }),
        }),
      );
      expect(notificationsService.create).toHaveBeenCalled();
      expect(digestService.queueForDigest).toHaveBeenCalledWith(
        'landlord-1',
        'NEW_APPLICATION',
        expect.objectContaining({ propertyTitle: 'Test Property', tenantName: 'Tenant Name' }),
      );
    });

    it('throws NotFoundException for missing property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.create('bad', 'tenant-1', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects applying to own property', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      await expect(service.create('prop-1', 'landlord-1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it.each([PropertyStatus.RENTED, PropertyStatus.ARCHIVED])(
      'rejects application for %s property',
      async (status) => {
        prisma.property.findUnique.mockResolvedValue({ ...mockProperty, status });
        await expect(service.create('prop-1', 'tenant-1', dto as any)).rejects.toThrow(
          'not currently accepting rental applications',
        );
      },
    );

    it('rejects duplicate active application', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create('prop-1', 'tenant-1', dto as any)).rejects.toThrow(
        'already have an active application',
      );
    });

    it('validates verified visit belongs to tenant and property', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue(null);
      prisma.visitRequest.findUnique.mockResolvedValue({
        id: 'visit-1',
        tenantId: 'other-tenant',
        propertyId: 'prop-1',
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: new Date(),
      });

      await expect(
        service.create('prop-1', 'tenant-1', { ...dto, verifiedVisitId: 'visit-1' } as any),
      ).rejects.toThrow('only use your own verified visits');
    });

    it('rejects visit for different property', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue(null);
      prisma.visitRequest.findUnique.mockResolvedValue({
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'other-prop',
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: new Date(),
      });

      await expect(
        service.create('prop-1', 'tenant-1', { ...dto, verifiedVisitId: 'visit-1' } as any),
      ).rejects.toThrow('must be for this property');
    });

    it('rejects unverified or incomplete visit', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue(null);
      prisma.visitRequest.findUnique.mockResolvedValue({
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        status: VisitStatus.ACCEPTED,
        visitVerifiedAt: null,
      });

      await expect(
        service.create('prop-1', 'tenant-1', { ...dto, verifiedVisitId: 'visit-1' } as any),
      ).rejects.toThrow('completed and verified');
    });

    it('rejects visit already linked to another application', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'other-app' });
      prisma.visitRequest.findUnique.mockResolvedValue({
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: new Date(),
      });

      await expect(
        service.create('prop-1', 'tenant-1', { ...dto, verifiedVisitId: 'visit-1' } as any),
      ).rejects.toThrow('already linked to another application');
    });

    it('creates application with verified visit', async () => {
      prisma.property.findUnique.mockResolvedValue(mockProperty);
      prisma.rentalApplication.findFirst.mockResolvedValue(null);
      prisma.visitRequest.findUnique.mockResolvedValue({
        id: 'visit-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        status: VisitStatus.COMPLETED,
        visitVerifiedAt: new Date(),
      });
      prisma.rentalApplication.create.mockResolvedValue(mockApplication);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.create('prop-1', 'tenant-1', { ...dto, verifiedVisitId: 'visit-1' } as any);

      expect(prisma.rentalApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verifiedVisitId: 'visit-1' }),
        }),
      );
      expect(digestService.queueForDigest).toHaveBeenCalledWith(
        'landlord-1',
        'NEW_APPLICATION',
        expect.objectContaining({ tenantName: 'A tenant' }),
      );
    });
  });

  describe('findTenantApplications / findLandlordApplications', () => {
    it('returns tenant applications', async () => {
      prisma.rentalApplication.findMany.mockResolvedValue([mockApplication]);
      const result = await service.findTenantApplications('tenant-1');
      expect(result).toHaveLength(1);
      expect(prisma.rentalApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });

    it('returns landlord applications filtered by property', async () => {
      prisma.rentalApplication.findMany.mockResolvedValue([]);
      await service.findLandlordApplications('landlord-1', 'prop-1');
      expect(prisma.rentalApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { property: { landlordId: 'landlord-1', id: 'prop-1' } },
        }),
      );
    });

    it('returns landlord applications without property filter', async () => {
      prisma.rentalApplication.findMany.mockResolvedValue([]);
      await service.findLandlordApplications('landlord-1');
      expect(prisma.rentalApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { property: { landlordId: 'landlord-1' } },
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException for missing application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('bad', 'user-1', [], { status: ApplicationStatus.REJECTED } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for unrelated user', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      await expect(
        service.updateStatus('app-1', 'stranger', [], { status: ApplicationStatus.REJECTED } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('tenant can withdraw own application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      prisma.rentalApplication.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.WITHDRAWN,
      });

      const result = await service.updateStatus(
        'app-1',
        'tenant-1',
        ['TENANT'],
        { status: ApplicationStatus.WITHDRAWN } as any,
      );

      expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
      expect(prisma.rentalApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: ApplicationStatus.WITHDRAWN },
      });
    });

    it('tenant cannot change to non-withdrawn status', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      await expect(
        service.updateStatus('app-1', 'tenant-1', ['TENANT'], {
          status: ApplicationStatus.REJECTED,
        } as any),
      ).rejects.toThrow('only withdraw');
    });

    it('admin can update status with notification', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      prisma.rentalApplication.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.UNDER_REVIEW,
        property: { id: 'prop-1', title: 'Test Property', area: 'Dhanmondi' },
        tenant: { id: 'tenant-1', fullName: 'T', email: 't@e.com' },
      });

      await service.updateStatus('app-1', 'admin-1', ['ADMIN'], {
        status: ApplicationStatus.UNDER_REVIEW,
      } as any);

      expect(notificationsService.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        'Application Under Review',
        expect.stringContaining('under review'),
        expect.any(Object),
      );
    });

    it('sends shortlist notification', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      prisma.rentalApplication.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.SHORTLISTED,
        property: { id: 'prop-1', title: 'P', area: 'A' },
      });

      await service.updateStatus('app-1', 'landlord-1', ['LANDLORD'], {
        status: ApplicationStatus.SHORTLISTED,
      } as any);

      expect(notificationsService.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        'Application Shortlisted',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('sends rejection notification', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      prisma.rentalApplication.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.REJECTED,
        property: { id: 'prop-1', title: 'P', area: 'A' },
      });

      await service.updateStatus('app-1', 'landlord-1', ['LANDLORD'], {
        status: ApplicationStatus.REJECTED,
      } as any);

      expect(notificationsService.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        'Application Rejected',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('sends withdrawal notification to landlord', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      prisma.rentalApplication.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.WITHDRAWN,
        property: { id: 'prop-1', title: 'P', area: 'A' },
      });

      await service.updateStatus('app-1', 'admin-1', ['ADMIN'], {
        status: ApplicationStatus.WITHDRAWN,
      } as any);

      expect(notificationsService.create).toHaveBeenCalledWith(
        'landlord-1',
        expect.any(String),
        'Application Withdrawn',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('returns early for unhandled status without notification', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
      const updated = { ...mockApplication, status: ApplicationStatus.SUBMITTED };
      prisma.rentalApplication.update.mockResolvedValue(updated);

      const result = await service.updateStatus('app-1', 'admin-1', ['ADMIN'], {
        status: ApplicationStatus.SUBMITTED,
      } as any);

      expect(result).toEqual(updated);
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    describe('SELECTED transaction', () => {
      const setupSelectedTx = () => {
        const tx = {
          rentalApplication: {
            update: vi.fn().mockResolvedValue({
              ...mockApplication,
              status: ApplicationStatus.SELECTED,
              property: mockProperty,
              tenant: { id: 'tenant-1', fullName: 'T', email: 't@e.com' },
            }),
            updateMany: vi.fn(),
          },
          property: { update: vi.fn() },
          visitRequest: {
            findMany: vi.fn().mockResolvedValue([]),
            updateMany: vi.fn(),
          },
        };
        prisma.$transaction.mockImplementation((cb: any) => cb(tx));
        return tx;
      };

      it('selects application, marks property rented, notifies tenant', async () => {
        prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
        const tx = setupSelectedTx();

        const result = await service.updateStatus('app-1', 'landlord-1', ['LANDLORD'], {
          status: ApplicationStatus.SELECTED,
        } as any);

        expect(result.status).toBe(ApplicationStatus.SELECTED);
        expect(tx.property.update).toHaveBeenCalledWith({
          where: { id: 'prop-1' },
          data: { status: PropertyStatus.RENTED },
        });
        expect(tx.rentalApplication.updateMany).toHaveBeenCalled();
        expect(notificationsService.create).toHaveBeenCalledWith(
          'tenant-1',
          expect.any(String),
          'Application Selected',
          expect.any(String),
          expect.any(Object),
        );
        expect(emailQueueService.queueNotificationEmail).toHaveBeenCalledWith(
          'tenant-1',
          'APPLICATION_SELECTED',
          expect.any(Object),
        );
      });

      it('cancels pending visits and notifies their tenants', async () => {
        prisma.rentalApplication.findUnique.mockResolvedValue(mockApplication);
        const tx = setupSelectedTx();
        tx.visitRequest.findMany.mockResolvedValue([
          { id: 'v1', tenantId: 'visitor-1' },
          { id: 'v2', tenantId: 'visitor-2' },
        ]);

        await service.updateStatus('app-1', 'landlord-1', ['LANDLORD'], {
          status: ApplicationStatus.SELECTED,
        } as any);

        expect(tx.visitRequest.updateMany).toHaveBeenCalled();
        expect(notificationsService.create).toHaveBeenCalledTimes(3);
        expect(emailQueueService.queueNotificationEmail).toHaveBeenCalledTimes(3);
      });
    });
  });
});
