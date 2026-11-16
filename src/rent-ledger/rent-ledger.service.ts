import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateRentPaymentDto,
  UpdateRentPaymentDto,
  CreateUtilityChargeDto,
  UpdateUtilityChargeDto,
  RentPaymentResponseDto,
  UtilityChargeResponseDto,
  RentPaymentStatus,
  UtilityChargeStatus,
} from './dto/rent-ledger.dto.js';

@Injectable()
export class RentLedgerService {
  constructor(private prisma: PrismaService) {}

  // Rent Payment Methods
  async createRentPayment(userId: string, dto: CreateRentPaymentDto): Promise<RentPaymentResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can create rent payments');
    }

    const rentPayment = await this.prisma.rentPayment.create({
      data: {
        propertyId: dto.propertyId,
        tenantId: dto.tenantId,
        landlordId: userId,
        amount: dto.amount,
        paymentDate: dto.paymentDate,
        dueDate: dto.dueDate,
        status: 'PENDING',
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
    });

    return this.mapRentPaymentToResponse(rentPayment);
  }

  async getRentPayments(userId: string, userRoles: string[]): Promise<RentPaymentResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isLandlord = userRoles.includes('LANDLORD');
    const isTenant = userRoles.includes('TENANT');

    let where: any = {};

    if (!isAdmin) {
      if (isLandlord) {
        where.landlordId = userId;
      } else if (isTenant) {
        where.tenantId = userId;
      } else {
        throw new ForbiddenException('Unauthorized');
      }
    }

    const payments = await this.prisma.rentPayment.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
          },
        },
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    return payments.map((p) => this.mapRentPaymentToResponse(p));
  }

  async getRentPaymentById(paymentId: string, userId: string, userRoles: string[]): Promise<RentPaymentResponseDto> {
    const payment = await this.prisma.rentPayment.findUnique({
      where: { id: paymentId },
      include: {
        property: true,
        tenant: true,
        landlord: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Rent payment not found');
    }

    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isLandlord = payment.landlordId === userId;
    const isTenant = payment.tenantId === userId;

    if (!isAdmin && !isLandlord && !isTenant) {
      throw new ForbiddenException('You do not have permission to access this payment');
    }

    return this.mapRentPaymentToResponse(payment);
  }

  async updateRentPayment(paymentId: string, userId: string, dto: UpdateRentPaymentDto): Promise<RentPaymentResponseDto> {
    const payment = await this.prisma.rentPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Rent payment not found');
    }

    if (payment.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can update rent payments');
    }

    const updatedPayment = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: dto.status,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
    });

    return this.mapRentPaymentToResponse(updatedPayment);
  }

  async deleteRentPayment(paymentId: string, userId: string): Promise<void> {
    const payment = await this.prisma.rentPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Rent payment not found');
    }

    if (payment.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can delete rent payments');
    }

    await this.prisma.rentPayment.delete({
      where: { id: paymentId },
    });
  }

  // Utility Charge Methods
  async createUtilityCharge(userId: string, dto: CreateUtilityChargeDto): Promise<UtilityChargeResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can create utility charges');
    }

    const utilityCharge = await this.prisma.utilityCharge.create({
      data: {
        propertyId: dto.propertyId,
        tenantId: dto.tenantId,
        landlordId: userId,
        chargeType: dto.chargeType,
        amount: dto.amount,
        billingMonth: dto.billingMonth,
        dueDate: dto.dueDate,
        status: 'PENDING',
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
    });

    return this.mapUtilityChargeToResponse(utilityCharge);
  }

  async getUtilityCharges(userId: string, userRoles: string[]): Promise<UtilityChargeResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isLandlord = userRoles.includes('LANDLORD');
    const isTenant = userRoles.includes('TENANT');

    let where: any = {};

    if (!isAdmin) {
      if (isLandlord) {
        where.landlordId = userId;
      } else if (isTenant) {
        where.tenantId = userId;
      } else {
        throw new ForbiddenException('Unauthorized');
      }
    }

    const charges = await this.prisma.utilityCharge.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
          },
        },
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    return charges.map((c) => this.mapUtilityChargeToResponse(c));
  }

  async getUtilityChargeById(chargeId: string, userId: string, userRoles: string[]): Promise<UtilityChargeResponseDto> {
    const charge = await this.prisma.utilityCharge.findUnique({
      where: { id: chargeId },
      include: {
        property: true,
        tenant: true,
        landlord: true,
      },
    });

    if (!charge) {
      throw new NotFoundException('Utility charge not found');
    }

    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isLandlord = charge.landlordId === userId;
    const isTenant = charge.tenantId === userId;

    if (!isAdmin && !isLandlord && !isTenant) {
      throw new ForbiddenException('You do not have permission to access this charge');
    }

    return this.mapUtilityChargeToResponse(charge);
  }

  async updateUtilityCharge(chargeId: string, userId: string, dto: UpdateUtilityChargeDto): Promise<UtilityChargeResponseDto> {
    const charge = await this.prisma.utilityCharge.findUnique({
      where: { id: chargeId },
    });

    if (!charge) {
      throw new NotFoundException('Utility charge not found');
    }

    if (charge.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can update utility charges');
    }

    const updatedCharge = await this.prisma.utilityCharge.update({
      where: { id: chargeId },
      data: {
        status: dto.status,
        paymentMethod: dto.paymentMethod,
        transactionId: dto.transactionId,
        notes: dto.notes,
      },
    });

    return this.mapUtilityChargeToResponse(updatedCharge);
  }

  async deleteUtilityCharge(chargeId: string, userId: string): Promise<void> {
    const charge = await this.prisma.utilityCharge.findUnique({
      where: { id: chargeId },
    });

    if (!charge) {
      throw new NotFoundException('Utility charge not found');
    }

    if (charge.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can delete utility charges');
    }

    await this.prisma.utilityCharge.delete({
      where: { id: chargeId },
    });
  }

  // Ledger Summary Methods
  async getLedgerSummary(userId: string, userRoles: string[]): Promise<any> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');
    const isLandlord = userRoles.includes('LANDLORD');

    let where: any = {};

    if (!isAdmin && isLandlord) {
      where.landlordId = userId;
    } else if (!isAdmin) {
      throw new ForbiddenException('Unauthorized');
    }

    const [rentPayments, utilityCharges] = await Promise.all([
      this.prisma.rentPayment.findMany({ where }),
      this.prisma.utilityCharge.findMany({ where }),
    ]);

    const totalRentCollected = rentPayments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRentPending = rentPayments
      .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalUtilitiesCollected = utilityCharges
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const totalUtilitiesPending = utilityCharges
      .filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      rentPayments: {
        total: rentPayments.length,
        collected: totalRentCollected,
        pending: totalRentPending,
      },
      utilityCharges: {
        total: utilityCharges.length,
        collected: totalUtilitiesCollected,
        pending: totalUtilitiesPending,
      },
      totalCollected: totalRentCollected + totalUtilitiesCollected,
      totalPending: totalRentPending + totalUtilitiesPending,
    };
  }

  private mapRentPaymentToResponse(payment: any): RentPaymentResponseDto {
    return {
      id: payment.id,
      propertyId: payment.propertyId,
      tenantId: payment.tenantId,
      landlordId: payment.landlordId,
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate,
      dueDate: payment.dueDate,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      notes: payment.notes,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private mapUtilityChargeToResponse(charge: any): UtilityChargeResponseDto {
    return {
      id: charge.id,
      propertyId: charge.propertyId,
      tenantId: charge.tenantId,
      landlordId: charge.landlordId,
      chargeType: charge.chargeType,
      amount: charge.amount.toString(),
      billingMonth: charge.billingMonth,
      dueDate: charge.dueDate,
      status: charge.status,
      paymentMethod: charge.paymentMethod,
      transactionId: charge.transactionId,
      notes: charge.notes,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    };
  }
}
