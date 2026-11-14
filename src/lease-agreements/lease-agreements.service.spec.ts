import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaseStatus } from '@prisma/client';
import { LeaseAgreementsService } from './lease-agreements.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('LeaseAgreementsService', () => {
  let service: LeaseAgreementsService;
  let prisma: any;

  const selectedApp = {
    id: 'app-1',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    status: 'SELECTED',
    property: {
      id: 'prop-1',
      landlordId: 'landlord-1',
      rentAmount: 25000,
      depositAmount: 50000,
      title: 'Test Property',
      addressLine: '123 St',
      area: 'Dhanmondi',
      city: 'Dhaka',
    },
    tenant: { id: 'tenant-1', fullName: 'Tenant' },
  };

  const lease = {
    id: 'lease-1',
    applicationId: 'app-1',
    landlordId: 'landlord-1',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    startDate: new Date('2025-02-01'),
    endDate: new Date('2026-02-01'),
    rentAmount: 25000,
    depositAmount: 50000,
    terms: { description: 'Standard terms', customTerms: '' },
    status: LeaseStatus.PENDING_SIGNATURE,
    landlordSigned: false,
    tenantSigned: false,
    signedAt: null,
    pdfUrl: null,
    landlordSignatureData: null,
    tenantSignatureData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      rentalApplication: { findUnique: vi.fn() },
      leaseAgreement: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaseAgreementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaseAgreementsService>(LeaseAgreementsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('createLeaseAgreement', () => {
    const dto = { applicationId: 'app-1', startDate: '2025-02-01', endDate: '2026-02-01' };

    it('creates lease for selected application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      prisma.leaseAgreement.create.mockResolvedValue(lease);

      const result = await service.createLeaseAgreement('landlord-1', dto as any);

      expect(result.id).toBe('lease-1');
      expect(result.status).toBe(LeaseStatus.PENDING_SIGNATURE);
      expect(prisma.leaseAgreement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-1',
          landlordId: 'landlord-1',
          tenantId: 'tenant-1',
          rentAmount: 25000,
          depositAmount: 50000,
          status: LeaseStatus.PENDING_SIGNATURE,
        }),
      });
    });

    it('uses custom terms when provided', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      prisma.leaseAgreement.create.mockResolvedValue(lease);

      await service.createLeaseAgreement('landlord-1', {
        ...dto,
        terms: 'Custom terms here',
      } as any);

      expect(prisma.leaseAgreement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ terms: 'Custom terms here' }),
      });
    });

    it('uses default terms when not provided', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      prisma.leaseAgreement.create.mockResolvedValue(lease);

      await service.createLeaseAgreement('landlord-1', dto as any);

      const createCall = prisma.leaseAgreement.create.mock.calls[0][0];
      expect(createCall.data.terms.description).toContain('Standard lease terms');
    });

    it('throws NotFoundException for missing application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(null);
      await expect(service.createLeaseAgreement('u', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects non-landlord', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      await expect(service.createLeaseAgreement('tenant-1', dto as any)).rejects.toThrow(
        'Only landlord can create lease',
      );
    });

    it('rejects non-selected application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue({
        ...selectedApp,
        status: 'SUBMITTED',
      });
      await expect(service.createLeaseAgreement('landlord-1', dto as any)).rejects.toThrow(
        'only be created for selected',
      );
    });

    it('rejects duplicate lease', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.leaseAgreement.findUnique.mockResolvedValue(lease);
      await expect(service.createLeaseAgreement('landlord-1', dto as any)).rejects.toThrow(
        'already exists',
      );
    });
  });

  describe('generateLeasePdf', () => {
    const fullLease = {
      ...lease,
      landlord: { fullName: 'Landlord Name' },
      tenant: { fullName: 'Tenant Name' },
      property: selectedApp.property,
    };

    it('generates PDF and stores URL', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(fullLease);
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      const result = await service.generateLeasePdf('lease-1');

      expect(result).toMatch(/^data:application\/pdf;base64,/);
      expect(prisma.leaseAgreement.update).toHaveBeenCalledWith({
        where: { id: 'lease-1' },
        data: { pdfUrl: result },
      });
    });

    it('handles string terms', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...fullLease,
        terms: 'Plain text terms',
      });
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      const result = await service.generateLeasePdf('lease-1');
      expect(result).toMatch(/^data:application\/pdf;base64,/);
    });

    it('handles object terms with description and customTerms', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...fullLease,
        terms: { description: 'Desc', customTerms: 'Custom' },
      });
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      const result = await service.generateLeasePdf('lease-1');
      expect(result).toMatch(/^data:application\/pdf;base64,/);
    });

    it('includes signed info when signed', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...fullLease,
        landlordSigned: true,
        tenantSigned: true,
        signedAt: new Date('2025-03-01'),
      });
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      const result = await service.generateLeasePdf('lease-1');
      expect(result).toMatch(/^data:application\/pdf;base64,/);
    });

    it('throws NotFoundException for missing lease', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      await expect(service.generateLeasePdf('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLeaseAgreement', () => {
    it('landlord can sign lease', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(lease);
      prisma.leaseAgreement.update.mockResolvedValue({
        ...lease,
        landlordSigned: true,
        landlordSignatureData: 'sig-data',
      });

      const result = await service.updateLeaseAgreement('lease-1', 'landlord-1', {
        landlordSignatureData: 'sig-data',
      } as any);

      expect(result.landlordSigned).toBe(true);
      expect(prisma.leaseAgreement.update).toHaveBeenCalledWith({
        where: { id: 'lease-1' },
        data: expect.objectContaining({
          landlordSignatureData: 'sig-data',
          landlordSigned: true,
        }),
      });
    });

    it('tenant signature does not mark landlord signed', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...lease,
        landlordSigned: true,
      });
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      await service.updateLeaseAgreement('lease-1', 'tenant-1', {
        tenantSignatureData: 'tsig',
      } as any);

      const updateCall = prisma.leaseAgreement.update.mock.calls[0][0];
      expect(updateCall.data.tenantSigned).toBe(true);
      expect(updateCall.data.landlordSigned).toBeUndefined();
    });

    it('marks lease as signed when both parties sign', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...lease,
        landlordSigned: true,
        tenantSigned: true,
        signedAt: null,
      });
      prisma.leaseAgreement.update.mockResolvedValue({
        ...lease,
        status: LeaseStatus.SIGNED,
        signedAt: new Date(),
      });

      const result = await service.updateLeaseAgreement('lease-1', 'tenant-1', {
        status: LeaseStatus.SIGNED,
      } as any);

      const updateCall = prisma.leaseAgreement.update.mock.calls[0][0];
      expect(updateCall.data.signedAt).toBeInstanceOf(Date);
      expect(updateCall.data.status).toBe(LeaseStatus.SIGNED);
    });

    it('does not re-sign already signed lease', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue({
        ...lease,
        landlordSigned: true,
        tenantSigned: true,
        signedAt: new Date('2025-03-01'),
      });
      prisma.leaseAgreement.update.mockResolvedValue(lease);

      await service.updateLeaseAgreement('lease-1', 'tenant-1', {} as any);

      const updateCall = prisma.leaseAgreement.update.mock.calls[0][0];
      expect(updateCall.data.signedAt).toBeUndefined();
    });

    it('rejects unauthorized user', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(lease);
      await expect(
        service.updateLeaseAgreement('lease-1', 'stranger', {} as any),
      ).rejects.toThrow('not authorized');
    });

    it('throws NotFoundException for missing lease', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      await expect(service.updateLeaseAgreement('bad', 'u', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLeaseAgreementById / getLeaseAgreementByApplication', () => {
    it('returns lease by id', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(lease);
      const result = await service.getLeaseAgreementById('lease-1');
      expect(result.id).toBe('lease-1');
      expect(result.rentAmount).toBe('25000');
    });

    it('throws NotFoundException for missing lease by id', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      await expect(service.getLeaseAgreementById('bad')).rejects.toThrow(NotFoundException);
    });

    it('returns lease by application', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(lease);
      const result = await service.getLeaseAgreementByApplication('app-1');
      expect(result.applicationId).toBe('app-1');
    });

    it('throws NotFoundException for missing lease by application', async () => {
      prisma.leaseAgreement.findUnique.mockResolvedValue(null);
      await expect(service.getLeaseAgreementByApplication('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
