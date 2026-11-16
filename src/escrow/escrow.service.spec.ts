import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { EscrowService } from './escrow.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;

  const makePayment = (overrides: Record<string, any> = {}) => ({
    id: 'pay-1',
    applicationId: 'app-1',
    amount: { toString: () => '10000', valueOf: () => 10000 },
    paymentType: PaymentType.SECURITY_DEPOSIT,
    status: PaymentStatus.COMPLETED,
    escrowStatus: EscrowStatus.HELD,
    escrowReleasedAt: null,
    escrowRefundedAt: null,
    escrowDisputedAt: null,
    platformFee: null,
    landlordAmount: null,
    tenantAmount: null,
    releaseReason: null,
    refundReason: null,
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    application: {
      id: 'app-1',
      tenantId: 'tenant-1',
      property: { id: 'prop-1', landlordId: 'landlord-1' },
      tenant: { id: 'tenant-1' },
    },
    ...overrides,
  });

  const adminRoles = [{ role: { name: 'ADMIN' } }];

  beforeEach(async () => {
    const mockPrisma = {
      payment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      notification: { create: vi.fn() },
      userRole: { findMany: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('getEscrowStatus / getEscrowByApplication / getHeldEscrowPayments', () => {
    it('returns escrow status for payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      const result = await service.getEscrowStatus('pay-1');
      expect(result.id).toBe('pay-1');
      expect(result.escrowStatus).toBe(EscrowStatus.HELD);
    });

    it('throws NotFoundException for missing payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.getEscrowStatus('bad')).rejects.toThrow(NotFoundException);
    });

    it('returns escrow payments for application', async () => {
      prisma.payment.findMany.mockResolvedValue([makePayment()]);
      const result = await service.getEscrowByApplication('app-1');
      expect(result).toHaveLength(1);
    });

    it('returns held escrow payments', async () => {
      prisma.payment.findMany.mockResolvedValue([makePayment()]);
      const result = await service.getHeldEscrowPayments();
      expect(result).toHaveLength(1);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { escrowStatus: EscrowStatus.HELD } }),
      );
    });
  });

  describe('releaseEscrow', () => {
    it('releases escrow for landlord with fee split', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.RELEASED,
        platformFee: { toString: () => '290.3' },
        landlordAmount: { toString: () => '9710' },
        tenantAmount: { toString: () => '0' },
      }));

      const result = await service.releaseEscrow('landlord-1', {
        paymentId: 'pay-1',
        releaseReason: 'Lease signed',
      } as any);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          escrowStatus: EscrowStatus.RELEASED,
          platformFee: expect.anything(),
          landlordAmount: expect.anything(),
          tenantAmount: expect.anything(),
          releaseReason: 'Lease signed',
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'tenant-1',
          type: 'ESCROW_RELEASED',
        }),
      });
    });

    it('throws NotFoundException for missing payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.releaseEscrow('landlord-1', { paymentId: 'bad' } as any))
        .rejects.toThrow(NotFoundException);
    });

    it('rejects release when escrow not held', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.RELEASED,
      }));
      await expect(service.releaseEscrow('landlord-1', { paymentId: 'pay-1' } as any))
        .rejects.toThrow('not in held status');
    });

    it('rejects release by non-landlord', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      await expect(service.releaseEscrow('tenant-1', { paymentId: 'pay-1' } as any))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('refundEscrow', () => {
    it('allows tenant to refund held escrow', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.REFUNDED,
        status: PaymentStatus.REFUNDED,
      }));

      const result = await service.refundEscrow('tenant-1', {
        paymentId: 'pay-1',
        refundReason: 'Deal fell through',
      } as any);

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          escrowStatus: EscrowStatus.REFUNDED,
          status: PaymentStatus.REFUNDED,
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'tenant-1', type: 'ESCROW_REFUNDED' }),
      });
    });

    it('allows admin to refund without tenant notification', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.userRole.findMany.mockResolvedValue(adminRoles);
      prisma.payment.update.mockResolvedValue(makePayment({ escrowStatus: EscrowStatus.REFUNDED }));

      await service.refundEscrow('admin-1', { paymentId: 'pay-1' } as any);

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('rejects refund by unrelated user', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.userRole.findMany.mockResolvedValue([]);
      await expect(service.refundEscrow('stranger', { paymentId: 'pay-1' } as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('rejects refund when escrow not held', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.RELEASED,
      }));
      await expect(service.refundEscrow('tenant-1', { paymentId: 'pay-1' } as any))
        .rejects.toThrow('not in held status');
    });
  });

  describe('disputeEscrow', () => {
    it('tenant can dispute and notifies landlord', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.DISPUTED,
      }));

      const result = await service.disputeEscrow('tenant-1', {
        paymentId: 'pay-1',
        disputeReason: 'Landlord not responding',
      } as any);

      expect(result.escrowStatus).toBe(EscrowStatus.DISPUTED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          escrowStatus: EscrowStatus.DISPUTED,
          releaseReason: 'Landlord not responding',
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'landlord-1', type: 'ESCROW_DISPUTED' }),
      });
    });

    it('landlord can dispute and notifies tenant', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.DISPUTED,
      }));

      await service.disputeEscrow('landlord-1', {
        paymentId: 'pay-1',
        disputeReason: 'Tenant violated lease',
      } as any);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'tenant-1' }),
      });
    });

    it('rejects dispute by unrelated user', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      await expect(service.disputeEscrow('stranger', {
        paymentId: 'pay-1',
        disputeReason: 'x',
      } as any)).rejects.toThrow(ForbiddenException);
    });

    it('rejects dispute when escrow not held', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.RELEASED,
      }));
      await expect(service.disputeEscrow('tenant-1', {
        paymentId: 'pay-1',
        disputeReason: 'x',
      } as any)).rejects.toThrow('not in held status');
    });
  });

  describe('resolveDispute', () => {
    const disputedPayment = () => makePayment({ escrowStatus: EscrowStatus.DISPUTED });

    it('admin can resolve dispute with release', async () => {
      prisma.payment.findUnique.mockResolvedValue(disputedPayment());
      prisma.userRole.findMany.mockResolvedValue(adminRoles);
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.RELEASED,
      }));

      const result = await service.resolveDispute('pay-1', 'admin-1', 'release');

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          escrowStatus: EscrowStatus.RELEASED,
          releaseReason: 'Dispute resolved in favor of landlord',
        }),
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('admin can resolve dispute with refund', async () => {
      prisma.payment.findUnique.mockResolvedValue(disputedPayment());
      prisma.userRole.findMany.mockResolvedValue(adminRoles);
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.REFUNDED,
      }));

      const result = await service.resolveDispute('pay-1', 'admin-1', 'refund');

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          escrowStatus: EscrowStatus.REFUNDED,
          refundReason: 'Dispute resolved in favor of tenant',
        }),
      });
    });

    it('admin can resolve dispute with split', async () => {
      prisma.payment.findUnique.mockResolvedValue(disputedPayment());
      prisma.userRole.findMany.mockResolvedValue(adminRoles);
      prisma.payment.update.mockResolvedValue(makePayment({
        escrowStatus: EscrowStatus.PARTIALLY_RELEASED,
      }));

      const result = await service.resolveDispute('pay-1', 'admin-1', 'split', 70);

      expect(result.escrowStatus).toBe(EscrowStatus.PARTIALLY_RELEASED);
      const updateCall = prisma.payment.update.mock.calls[0][0];
      expect(updateCall.data.landlordAmount).toBeCloseTo(6796.79, 1);
      expect(updateCall.data.tenantAmount).toBeCloseTo(2912.91, 1);
      expect(updateCall.data.platformFee).toBeCloseTo(290.3, 1);
    });

    it('rejects resolve when escrow not disputed', async () => {
      prisma.payment.findUnique.mockResolvedValue(makePayment());
      await expect(service.resolveDispute('pay-1', 'admin-1', 'release'))
        .rejects.toThrow('not in disputed status');
    });

    it('rejects resolve by non-admin', async () => {
      prisma.payment.findUnique.mockResolvedValue(disputedPayment());
      prisma.userRole.findMany.mockResolvedValue([]);
      await expect(service.resolveDispute('pay-1', 'tenant-1', 'release'))
        .rejects.toThrow(ForbiddenException);
    });

    it('handles split without percentage (empty update)', async () => {
      prisma.payment.findUnique.mockResolvedValue(disputedPayment());
      prisma.userRole.findMany.mockResolvedValue(adminRoles);
      prisma.payment.update.mockResolvedValue(disputedPayment());

      await service.resolveDispute('pay-1', 'admin-1', 'split');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {},
      });
    });
  });

  describe('calculateEscrowSplit', () => {
    it('calculates platform fee correctly', async () => {
      const split = await service.calculateEscrowSplit(10000);
      // fee = 10000 * 2.9% + 0.30 = 290.30
      expect(split.platformFee).toBeCloseTo(290.3, 1);
      expect(split.landlordAmount).toBeCloseTo(9709.7, 1);
      expect(split.tenantAmount).toBe(0);
    });

    it('handles small amounts', async () => {
      const split = await service.calculateEscrowSplit(100);
      expect(split.platformFee).toBeCloseTo(3.2, 1);
      expect(split.landlordAmount).toBeCloseTo(96.8, 1);
    });
  });
});
