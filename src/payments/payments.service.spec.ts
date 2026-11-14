import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentType, PaymentStatus, EscrowStatus } from '@prisma/client';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;

  const mockPayment = {
    id: 'pay-1',
    applicationId: 'app-1',
    visitRequestId: null,
    amount: { toString: () => '25000' },
    paymentType: PaymentType.FIRST_MONTH_RENT,
    status: PaymentStatus.PENDING,
    transactionId: null,
    paidAt: null,
    escrowStatus: EscrowStatus.NOT_APPLICABLE,
    escrowReleasedAt: null,
    escrowRefundedAt: null,
    escrowDisputedAt: null,
    platformFee: null,
    landlordAmount: null,
    tenantAmount: null,
    releaseReason: null,
    refundReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      rentalApplication: { findUnique: vi.fn() },
      payment: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      visitRequest: { findUnique: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('initiatePayment', () => {
    const selectedApp = {
      id: 'app-1',
      tenantId: 'tenant-1',
      status: 'SELECTED',
      property: { depositAmount: 50000, rentAmount: 25000 },
    };

    it('initiates rent payment for selected application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.payment.create.mockResolvedValue({ ...mockPayment, id: 'pay-1' });
      prisma.payment.update.mockResolvedValue(mockPayment);

      const result = await service.initiatePayment('tenant-1', {
        applicationId: 'app-1',
        paymentType: PaymentType.FIRST_MONTH_RENT,
      } as any);

      expect(result.paymentId).toBe('pay-1');
      expect(result.amount).toBe(2500000);
      expect(result.currency).toBe('bdt');
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-1',
          amount: 25000,
          paymentType: PaymentType.FIRST_MONTH_RENT,
          status: PaymentStatus.PENDING,
        }),
      });
    });

    it('uses deposit amount for security deposit payments', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      prisma.payment.create.mockResolvedValue(mockPayment);
      prisma.payment.update.mockResolvedValue(mockPayment);

      await service.initiatePayment('tenant-1', {
        applicationId: 'app-1',
        paymentType: PaymentType.SECURITY_DEPOSIT,
      } as any);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 50000 }),
      });
    });

    it('throws NotFoundException for missing application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(null);
      await expect(
        service.initiatePayment('tenant-1', { applicationId: 'bad' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects payment for other tenant application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue(selectedApp);
      await expect(
        service.initiatePayment('other-user', { applicationId: 'app-1' } as any),
      ).rejects.toThrow('only initiate payments for your own');
    });

    it('rejects payment for non-selected application', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue({
        ...selectedApp,
        status: 'SUBMITTED',
      });
      await expect(
        service.initiatePayment('tenant-1', { applicationId: 'app-1' } as any),
      ).rejects.toThrow('only be initiated for selected');
    });

    it('rejects when amount unavailable', async () => {
      prisma.rentalApplication.findUnique.mockResolvedValue({
        ...selectedApp,
        property: { depositAmount: null, rentAmount: 25000 },
      });
      await expect(
        service.initiatePayment('tenant-1', {
          applicationId: 'app-1',
          paymentType: PaymentType.SECURITY_DEPOSIT,
        } as any),
      ).rejects.toThrow('Amount not available');
    });
  });

  describe('confirmPayment', () => {
    it('confirms pending payment with escrow hold for deposit types', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        application: { id: 'app-1' },
      });
      prisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        escrowStatus: EscrowStatus.HELD,
      });

      const result = await service.confirmPayment('pay-1');

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          escrowStatus: EscrowStatus.HELD,
        }),
      });
    });

    it('does not hold escrow for other payment types', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        paymentType: PaymentType.PLATFORM_FEE,
        application: { id: 'app-1' },
      });
      prisma.payment.update.mockResolvedValue(mockPayment);

      await service.confirmPayment('pay-1');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ escrowStatus: EscrowStatus.NOT_APPLICABLE }),
      });
    });

    it('returns early for already completed payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        application: { id: 'app-1' },
      });

      const result = await service.confirmPayment('pay-1');

      expect(result.id).toBe('pay-1');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for missing payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.confirmPayment('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPaymentByApplication / getPaymentById', () => {
    it('returns payments for application', async () => {
      prisma.payment.findMany.mockResolvedValue([mockPayment]);
      const result = await service.getPaymentByApplication('app-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pay-1');
    });

    it('returns payment by id', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment);
      const result = await service.getPaymentById('pay-1');
      expect(result.id).toBe('pay-1');
    });

    it('throws NotFoundException for missing payment by id', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.getPaymentById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('initiateBookingDeposit', () => {
    const acceptedVisit = {
      id: 'visit-1',
      tenantId: 'tenant-1',
      status: 'ACCEPTED',
      property: { id: 'prop-1' },
    };

    it('initiates booking deposit for accepted visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(acceptedVisit);
      prisma.payment.create.mockResolvedValue({ ...mockPayment, id: 'pay-2' });
      prisma.payment.update.mockResolvedValue(mockPayment);

      const result = await service.initiateBookingDeposit('tenant-1', 'visit-1', 5000);

      expect(result.paymentId).toBe('pay-2');
      expect(result.amount).toBe(500000);
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'visit-1',
          amount: 5000,
          paymentType: PaymentType.BOOKING_DEPOSIT,
        }),
      });
    });

    it('throws NotFoundException for missing visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(null);
      await expect(service.initiateBookingDeposit('t', 'bad', 100)).rejects.toThrow(NotFoundException);
    });

    it('rejects deposit for other tenant visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue(acceptedVisit);
      await expect(service.initiateBookingDeposit('other', 'visit-1', 100)).rejects.toThrow(
        'only initiate payments for your own visits',
      );
    });

    it('rejects deposit for non-accepted visit', async () => {
      prisma.visitRequest.findUnique.mockResolvedValue({ ...acceptedVisit, status: 'PENDING' });
      await expect(service.initiateBookingDeposit('tenant-1', 'visit-1', 100)).rejects.toThrow(
        'only be initiated for accepted visits',
      );
    });
  });
});
