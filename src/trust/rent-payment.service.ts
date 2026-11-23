import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRentPaymentDto, AcknowledgePaymentDto, RentPaymentResponseDto } from './dto/rent-payment.dto.js';
import { TrustScoreService, TrustEventType } from './trust-score.service.js';
import { NotificationType } from '@prisma/client';

@Injectable()
export class RentPaymentService {
  constructor(
    private prisma: PrismaService,
    private trustScoreService: TrustScoreService,
  ) {}

  async createRentPayment(userId: string, dto: CreateRentPaymentDto): Promise<RentPaymentResponseDto> {
    // Only landlord can create rent payment records
    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { id: dto.leaseId },
      include: { property: true, tenant: true, landlord: true },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (lease.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can record rent payments');
    }

    const payment = await this.prisma.rentPayment.create({
      data: {
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        landlordId: lease.landlordId,
        leaseId: dto.leaseId,
        amount: dto.amount,
        paymentDate: dto.paymentDate,
        dueDate: dto.dueDate,
        status: 'PENDING',
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Notify tenant to acknowledge payment
    await this.prisma.notification.create({
      data: {
        userId: lease.tenantId,
        type: NotificationType.RENT_PAYMENT_RECORDED,
        title: 'Rent Payment Recorded',
        message: `A rent payment of ${dto.amount} BDT has been recorded for ${lease.property.title}. Please acknowledge if correct.`,
        data: { paymentId: payment.id, amount: dto.amount, leaseId: dto.leaseId },
      },
    });

    return this.mapToResponse(payment);
  }

  async acknowledgePayment(userId: string, dto: AcknowledgePaymentDto): Promise<RentPaymentResponseDto> {
    const payment = await this.prisma.rentPayment.findUnique({
      where: { id: dto.paymentId },
      include: {
        tenant: true,
        landlord: true,
        property: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Only tenant can acknowledge their own payments
    if (payment.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can acknowledge rent payments');
    }

    if (payment.status === 'ACKNOWLEDGED') {
      throw new BadRequestException('Payment already acknowledged');
    }

    const updated = await this.prisma.rentPayment.update({
      where: { id: dto.paymentId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Update trust scores
    await this.trustScoreService.updateTrustScore(
      payment.tenantId,
      'TENANT',
      TrustEventType.PAYMENT_ACKNOWLEDGED,
      payment.id,
      { amount: Number(payment.amount) },
    );

    // Notify landlord
    await this.prisma.notification.create({
      data: {
        userId: payment.landlordId,
        type: NotificationType.RENT_PAYMENT_ACKNOWLEDGED,
        title: 'Rent Payment Acknowledged',
        message: `Tenant has acknowledged the rent payment of ${payment.amount} BDT for ${payment.property.title}`,
        data: { paymentId: payment.id, amount: payment.amount },
      },
    });

    return this.mapToResponse(updated);
  }

  async disputePayment(userId: string, paymentId: string, reason: string): Promise<RentPaymentResponseDto> {
    const payment = await this.prisma.rentPayment.findUnique({
      where: { id: paymentId },
      include: {
        tenant: true,
        landlord: true,
        property: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Only tenant can dispute their own payments
    if (payment.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can dispute rent payments');
    }

    const updated = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: 'DISPUTED',
        disputeReason: reason,
      },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Notify landlord
    await this.prisma.notification.create({
      data: {
        userId: payment.landlordId,
        type: NotificationType.RENT_PAYMENT_DISPUTED,
        title: 'Rent Payment Disputed',
        message: `Tenant has disputed the rent payment of ${payment.amount} BDT for ${payment.property.title}. Reason: ${reason}`,
        data: { paymentId: payment.id, amount: payment.amount, reason },
      },
    });

    return this.mapToResponse(updated);
  }

  async getPaymentsForLease(leaseId: string, userId: string, userRoles: string[]): Promise<RentPaymentResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { id: leaseId },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (!isAdmin && lease.tenantId !== userId && lease.landlordId !== userId) {
      throw new ForbiddenException('You are not part of this lease');
    }

    const payments = await this.prisma.rentPayment.findMany({
      where: { leaseId },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((p) => this.mapToResponse(p));
  }

  async getPaymentsForUser(userId: string, userRoles: string[]): Promise<RentPaymentResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    let where: any = {};

    if (!isAdmin) {
      where = {
        OR: [
          { tenantId: userId },
          { landlordId: userId },
        ],
      };
    }

    const payments = await this.prisma.rentPayment.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((p) => this.mapToResponse(p));
  }

  private mapToResponse(payment: any): RentPaymentResponseDto {
    return {
      id: payment.id,
      propertyId: payment.propertyId,
      tenantId: payment.tenantId,
      landlordId: payment.landlordId,
      leaseId: payment.leaseId,
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate,
      dueDate: payment.dueDate,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      notes: payment.notes,
      acknowledgedAt: payment.acknowledgedAt,
      acknowledgedBy: payment.acknowledgedBy,
      disputeReason: payment.disputeReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      tenant: payment.tenant ? {
        id: payment.tenant.id,
        fullName: payment.tenant.fullName,
        email: payment.tenant.email,
      } : undefined,
      landlord: payment.landlord ? {
        id: payment.landlord.id,
        fullName: payment.landlord.fullName,
      } : undefined,
      property: payment.property ? {
        id: payment.property.id,
        title: payment.property.title,
      } : undefined,
    };
  }
}
