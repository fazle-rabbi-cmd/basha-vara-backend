import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RentLedgerService } from './rent-ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('RentLedgerService', () => {
  let service: RentLedgerService;
  let prisma: any;

  const rentPayment = {
    id: 'rp-1',
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    landlordId: 'landlord-1',
    amount: 15000,
    paymentDate: new Date('2025-01-01'),
    dueDate: new Date('2025-02-01'),
    status: 'PENDING',
    paymentMethod: 'BKASH',
    transactionId: 'tx-1',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const utilityCharge = {
    id: 'uc-1',
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    landlordId: 'landlord-1',
    chargeType: 'ELECTRICITY',
    amount: 1200,
    billingMonth: '2025-01',
    dueDate: new Date('2025-02-01'),
    status: 'PENDING',
    paymentMethod: null,
    transactionId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      property: { findUnique: vi.fn() },
      rentPayment: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      utilityCharge: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentLedgerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RentLedgerService>(RentLedgerService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  const rentDto = {
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    amount: 15000,
    paymentDate: new Date('2025-01-01'),
    dueDate: new Date('2025-02-01'),
    paymentMethod: 'BKASH',
    transactionId: 'tx-1',
  };

  const utilityDto = {
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    chargeType: 'ELECTRICITY',
    amount: 1200,
    billingMonth: '2025-01',
    dueDate: new Date('2025-02-01'),
  };

  describe('createRentPayment', () => {
    it('creates payment for property owner', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1', landlordId: 'landlord-1' });
      prisma.rentPayment.create.mockResolvedValue(rentPayment);

      const result = await service.createRentPayment('landlord-1', rentDto as any);

      expect(result.id).toBe('rp-1');
      expect(result.amount).toBe('15000');
      expect(prisma.rentPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          landlordId: 'landlord-1',
          status: 'PENDING',
        }),
      });
    });

    it('throws NotFoundException for missing property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.createRentPayment('u', rentDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects non-landlord', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1', landlordId: 'other' });
      await expect(service.createRentPayment('user-1', rentDto as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRentPayments', () => {
    it('returns all payments for admin', async () => {
      prisma.rentPayment.findMany.mockResolvedValue([rentPayment]);
      const result = await service.getRentPayments('admin-1', ['ADMIN']);
      expect(result).toHaveLength(1);
      expect(prisma.rentPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by landlordId for landlord role', async () => {
      prisma.rentPayment.findMany.mockResolvedValue([]);
      await service.getRentPayments('landlord-1', ['LANDLORD']);
      expect(prisma.rentPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { landlordId: 'landlord-1' } }),
      );
    });

    it('filters by tenantId for tenant role', async () => {
      prisma.rentPayment.findMany.mockResolvedValue([]);
      await service.getRentPayments('tenant-1', ['TENANT']);
      expect(prisma.rentPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });

    it('throws ForbiddenException for unknown role', async () => {
      await expect(service.getRentPayments('user-1', ['GUEST'])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRentPaymentById', () => {
    it('allows landlord to view own payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      const result = await service.getRentPaymentById('rp-1', 'landlord-1', []);
      expect(result.id).toBe('rp-1');
    });

    it('allows tenant to view own payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      const result = await service.getRentPaymentById('rp-1', 'tenant-1', []);
      expect(result.id).toBe('rp-1');
    });

    it('allows admin to view any payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      const result = await service.getRentPaymentById('rp-1', 'admin-1', ['SUPER_ADMIN']);
      expect(result.id).toBe('rp-1');
    });

    it('throws NotFoundException for missing payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(null);
      await expect(service.getRentPaymentById('bad', 'u', [])).rejects.toThrow(NotFoundException);
    });

    it('rejects unrelated user', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      await expect(service.getRentPaymentById('rp-1', 'stranger', [])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRentPayment / deleteRentPayment', () => {
    it('landlord can update payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      prisma.rentPayment.update.mockResolvedValue({ ...rentPayment, status: 'PAID' });

      const result = await service.updateRentPayment('rp-1', 'landlord-1', { status: 'PAID' } as any);
      expect(result.status).toBe('PAID');
    });

    it('rejects update by non-landlord', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      await expect(service.updateRentPayment('rp-1', 'tenant-1', {} as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException updating missing payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(null);
      await expect(service.updateRentPayment('bad', 'u', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('landlord can delete payment', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      prisma.rentPayment.delete.mockResolvedValue({});

      await service.deleteRentPayment('rp-1', 'landlord-1');
      expect(prisma.rentPayment.delete).toHaveBeenCalledWith({ where: { id: 'rp-1' } });
    });

    it('rejects delete by non-landlord', async () => {
      prisma.rentPayment.findUnique.mockResolvedValue(rentPayment);
      await expect(service.deleteRentPayment('rp-1', 'tenant-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createUtilityCharge', () => {
    it('creates charge for property owner', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1', landlordId: 'landlord-1' });
      prisma.utilityCharge.create.mockResolvedValue(utilityCharge);

      const result = await service.createUtilityCharge('landlord-1', utilityDto as any);
      expect(result.id).toBe('uc-1');
      expect(result.status).toBe('PENDING');
    });

    it('rejects non-landlord', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1', landlordId: 'other' });
      await expect(service.createUtilityCharge('user-1', utilityDto as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUtilityCharges', () => {
    it('returns charges scoped by role', async () => {
      prisma.utilityCharge.findMany.mockResolvedValue([utilityCharge]);
      const result = await service.getUtilityCharges('tenant-1', ['TENANT']);
      expect(result).toHaveLength(1);
      expect(prisma.utilityCharge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });

    it('throws ForbiddenException for unknown role', async () => {
      await expect(service.getUtilityCharges('u', ['GUEST'])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUtilityChargeById / updateUtilityCharge / deleteUtilityCharge', () => {
    it('allows tenant to view own charge', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      const result = await service.getUtilityChargeById('uc-1', 'tenant-1', []);
      expect(result.id).toBe('uc-1');
    });

    it('rejects unrelated user viewing charge', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      await expect(service.getUtilityChargeById('uc-1', 'stranger', [])).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing charge', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(null);
      await expect(service.getUtilityChargeById('bad', 'u', [])).rejects.toThrow(NotFoundException);
    });

    it('landlord can update charge', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      prisma.utilityCharge.update.mockResolvedValue({ ...utilityCharge, status: 'PAID' });
      const result = await service.updateUtilityCharge('uc-1', 'landlord-1', { status: 'PAID' } as any);
      expect(result.status).toBe('PAID');
    });

    it('rejects update by non-landlord', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      await expect(service.updateUtilityCharge('uc-1', 'tenant-1', {} as any)).rejects.toThrow(ForbiddenException);
    });

    it('landlord can delete charge', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      prisma.utilityCharge.delete.mockResolvedValue({});
      await service.deleteUtilityCharge('uc-1', 'landlord-1');
      expect(prisma.utilityCharge.delete).toHaveBeenCalled();
    });

    it('rejects delete by non-landlord', async () => {
      prisma.utilityCharge.findUnique.mockResolvedValue(utilityCharge);
      await expect(service.deleteUtilityCharge('uc-1', 'tenant-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getLedgerSummary', () => {
    it('returns summary for landlord', async () => {
      prisma.rentPayment.findMany.mockResolvedValue([
        { ...rentPayment, status: 'PAID', amount: 15000 },
        { ...rentPayment, id: 'rp-2', status: 'PENDING', amount: 15000 },
        { ...rentPayment, id: 'rp-3', status: 'OVERDUE', amount: 15000 },
      ]);
      prisma.utilityCharge.findMany.mockResolvedValue([
        { ...utilityCharge, status: 'PAID', amount: 1200 },
        { ...utilityCharge, id: 'uc-2', status: 'PENDING', amount: 800 },
      ]);

      const result = await service.getLedgerSummary('landlord-1', ['LANDLORD']);

      expect(result.rentPayments.total).toBe(3);
      expect(result.rentPayments.collected).toBe(15000);
      expect(result.rentPayments.pending).toBe(30000);
      expect(result.utilityCharges.collected).toBe(1200);
      expect(result.utilityCharges.pending).toBe(800);
      expect(result.totalCollected).toBe(16200);
      expect(result.totalPending).toBe(30800);
    });

    it('returns summary for admin (all records)', async () => {
      prisma.rentPayment.findMany.mockResolvedValue([]);
      prisma.utilityCharge.findMany.mockResolvedValue([]);

      const result = await service.getLedgerSummary('admin-1', ['ADMIN']);

      expect(prisma.rentPayment.findMany).toHaveBeenCalledWith({ where: {} });
      expect(result.totalCollected).toBe(0);
    });

    it('throws ForbiddenException for tenant role', async () => {
      await expect(service.getLedgerSummary('tenant-1', ['TENANT'])).rejects.toThrow(ForbiddenException);
    });
  });
});
