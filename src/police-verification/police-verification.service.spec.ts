import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PoliceVerificationService } from './police-verification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PoliceVerificationService', () => {
  let service: PoliceVerificationService;
  let prisma: any;

  const property = {
    id: 'prop-1',
    title: 'Test Property',
    addressLine: '123 St',
    area: 'Dhanmondi',
    city: 'Dhaka',
    landlordId: 'landlord-1',
    landlord: { id: 'landlord-1', fullName: 'Landlord', phone: '017', email: 'l@e.com' },
  };

  const tenant = {
    id: 'tenant-1',
    fullName: 'Tenant Name',
    phone: '018',
    email: 't@e.com',
    avatarUrl: 'https://avatar.url',
    tenantProfile: { occupation: 'Engineer' },
    applicationProfile: { address: 'Tenant Addr', employerName: 'Corp', monthlyIncome: 50000 },
    userDocuments: [{ documentType: 'id', fileName: 'nid.pdf' }],
  };

  const verification = {
    id: 'pv-1',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    applicationId: 'app-1',
    landlordId: 'landlord-1',
    status: 'PENDING',
    formData: { tenantName: 'Tenant Name' },
    pdfUrl: null,
    submittedAt: null,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      property: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      policeVerification: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userRole: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliceVerificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PoliceVerificationService>(PoliceVerificationService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('generatePoliceVerification', () => {
    const dto = { tenantId: 'tenant-1', propertyId: 'prop-1', applicationId: 'app-1' };

    it('generates verification with form data', async () => {
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.user.findUnique.mockResolvedValue(tenant);
      prisma.policeVerification.findFirst.mockResolvedValue(null);
      prisma.policeVerification.create.mockResolvedValue(verification);

      const result = await service.generatePoliceVerification('landlord-1', dto as any);

      expect(result.id).toBe('pv-1');
      expect(result.status).toBe('PENDING');
      expect(prisma.policeVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          landlordId: 'landlord-1',
          status: 'PENDING',
          formData: expect.objectContaining({
            tenantName: 'Tenant Name',
            tenantNid: 'nid.pdf',
            tenantOccupation: 'Engineer',
            landlordName: 'Landlord',
          }),
        }),
      });
    });

    it('throws NotFoundException for missing property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.generatePoliceVerification('u', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects non-landlord', async () => {
      prisma.property.findUnique.mockResolvedValue(property);
      await expect(service.generatePoliceVerification('tenant-1', dto as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing tenant', async () => {
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.generatePoliceVerification('landlord-1', dto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects duplicate pending verification', async () => {
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.user.findUnique.mockResolvedValue(tenant);
      prisma.policeVerification.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.generatePoliceVerification('landlord-1', dto as any)).rejects.toThrow(
        'already exists',
      );
    });

    it('handles tenant without profiles/documents', async () => {
      prisma.property.findUnique.mockResolvedValue(property);
      prisma.user.findUnique.mockResolvedValue({
        id: 'tenant-1',
        fullName: 'Bare Tenant',
        email: 'b@e.com',
        phone: null,
        avatarUrl: null,
        tenantProfile: null,
        applicationProfile: null,
        userDocuments: [],
      });
      prisma.policeVerification.findFirst.mockResolvedValue(null);
      prisma.policeVerification.create.mockResolvedValue(verification);

      await service.generatePoliceVerification('landlord-1', dto as any);

      const createCall = prisma.policeVerification.create.mock.calls[0][0];
      expect(createCall.data.formData.tenantNid).toBe('Not provided');
      expect(createCall.data.formData.tenantOccupation).toBe('');
    });
  });

  describe('generatePdf', () => {
    const fullVerification = {
      ...verification,
      tenant: { ...tenant, tenantProfile: tenant.tenantProfile, applicationProfile: tenant.applicationProfile, userDocuments: tenant.userDocuments },
      property,
      landlord: property.landlord,
      formData: {
        tenantName: 'Tenant Name',
        tenantNid: 'nid.pdf',
        tenantPhone: '018',
        tenantEmail: 't@e.com',
        tenantAddress: 'Addr',
        tenantOccupation: 'Engineer',
        tenantEmployer: 'Corp',
        tenantMonthlyIncome: '50000',
        propertyTitle: 'Test Property',
        propertyAddress: '123 St, Dhanmondi, Dhaka',
        landlordName: 'Landlord',
        landlordPhone: '017',
        landlordEmail: 'l@e.com',
        moveInDate: '2025-02-01',
        formDate: '2025-01-15',
      },
    };

    it('generates PDF for landlord', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(fullVerification);
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.policeVerification.update.mockResolvedValue({});

      const result = await service.generatePdf('pv-1', 'landlord-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(prisma.policeVerification.update).toHaveBeenCalledWith({
        where: { id: 'pv-1' },
        data: expect.objectContaining({ status: 'GENERATED' }),
      });
    });

    it('generates PDF for tenant', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(fullVerification);
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.policeVerification.update.mockResolvedValue({});

      const result = await service.generatePdf('pv-1', 'tenant-1');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('generates PDF for admin', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(fullVerification);
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'ADMIN' } }]);
      prisma.policeVerification.update.mockResolvedValue({});

      const result = await service.generatePdf('pv-1', 'admin-1');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('rejects unrelated user', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(fullVerification);
      prisma.userRole.findMany.mockResolvedValue([]);
      await expect(service.generatePdf('pv-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing verification', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(null);
      await expect(service.generatePdf('bad', 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPoliceVerifications', () => {
    it('returns verifications scoped to user for non-admin', async () => {
      prisma.policeVerification.findMany.mockResolvedValue([verification]);
      const result = await service.getPoliceVerifications('tenant-1', ['TENANT']);
      expect(result).toHaveLength(1);
      expect(prisma.policeVerification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ tenantId: 'tenant-1' }, { landlordId: 'tenant-1' }] },
        }),
      );
    });

    it('returns all verifications for admin', async () => {
      prisma.policeVerification.findMany.mockResolvedValue([]);
      await service.getPoliceVerifications('admin-1', ['ADMIN']);
      expect(prisma.policeVerification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('submitVerification', () => {
    it('tenant can submit generated verification', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue({
        ...verification,
        status: 'GENERATED',
      });
      prisma.policeVerification.update.mockResolvedValue({
        ...verification,
        status: 'SUBMITTED',
      });

      const result = await service.submitVerification('pv-1', 'tenant-1');
      expect(result.status).toBe('SUBMITTED');
      expect(prisma.policeVerification.update).toHaveBeenCalledWith({
        where: { id: 'pv-1' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      });
    });

    it('rejects non-tenant', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(verification);
      await expect(service.submitVerification('pv-1', 'landlord-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects submission before generation', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(verification);
      await expect(service.submitVerification('pv-1', 'tenant-1')).rejects.toThrow(
        'must be generated before submission',
      );
    });

    it('throws NotFoundException for missing verification', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(null);
      await expect(service.submitVerification('bad', 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyPoliceVerification', () => {
    it('admin can verify', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue({
        ...verification,
        status: 'SUBMITTED',
      });
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'ADMIN' } }]);
      prisma.policeVerification.update.mockResolvedValue({
        ...verification,
        status: 'VERIFIED',
      });

      const result = await service.verifyPoliceVerification('pv-1', 'admin-1');
      expect(result.status).toBe('VERIFIED');
    });

    it('rejects non-admin', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(verification);
      prisma.userRole.findMany.mockResolvedValue([]);
      await expect(service.verifyPoliceVerification('pv-1', 'landlord-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing verification', async () => {
      prisma.policeVerification.findUnique.mockResolvedValue(null);
      await expect(service.verifyPoliceVerification('bad', 'u')).rejects.toThrow(NotFoundException);
    });
  });
});
