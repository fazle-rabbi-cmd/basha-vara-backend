import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EscrowActionDto, ReleaseEscrowDto, RefundEscrowDto, DisputeEscrowDto, EscrowResponseDto } from './dto/escrow.dto.js';
import { EscrowStatus, PaymentStatus, PaymentType } from '@prisma/client';

@Injectable()
export class EscrowService {
  private readonly PLATFORM_FEE_PERCENTAGE = 2.9;
  private readonly PLATFORM_FEE_FIXED = 0.30;

  constructor(private prisma: PrismaService) {}

  async getEscrowStatus(paymentId: string): Promise<EscrowResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { application: { include: { property: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponse(payment);
  }

  async getEscrowByApplication(applicationId: string): Promise<EscrowResponseDto[]> {
    const payments = await this.prisma.payment.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.mapToResponse(p));
  }

  async getHeldEscrowPayments(): Promise<EscrowResponseDto[]> {
    const payments = await this.prisma.payment.findMany({
      where: { escrowStatus: EscrowStatus.HELD },
      include: { application: { include: { property: true } } },
      orderBy: { paidAt: 'asc' },
    });

    return payments.map((p) => this.mapToResponse(p));
  }

  async releaseEscrow(userId: string, dto: ReleaseEscrowDto): Promise<EscrowResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { application: { include: { property: true, tenant: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException('Escrow is not in held status');
    }

    if (payment.application?.property?.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can release escrow');
    }

    const split = await this.calculateEscrowSplit(Number(payment.amount));

    const updatedPayment = await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: {
        escrowStatus: EscrowStatus.RELEASED,
        escrowReleasedAt: new Date(),
        platformFee: split.platformFee,
        landlordAmount: split.landlordAmount,
        tenantAmount: split.tenantAmount,
        releaseReason: dto.releaseReason,
        status: PaymentStatus.COMPLETED,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: payment.application?.tenantId,
        type: 'ESCROW_RELEASED',
        title: 'Escrow Released',
        message: `Your escrow payment of ${payment.amount} BDT has been released to the landlord`,
        data: { paymentId: payment.id, amount: payment.amount },
      },
    });

    return this.mapToResponse(updatedPayment);
  }

  async refundEscrow(userId: string, dto: RefundEscrowDto): Promise<EscrowResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { application: { include: { property: true, tenant: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException('Escrow is not in held status');
    }

    const isAdmin = await this.isUserAdmin(userId);
    const isTenant = payment.application?.tenantId === userId;

    if (!isAdmin && !isTenant) {
      throw new ForbiddenException('Only admin or tenant can refund escrow');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: {
        escrowStatus: EscrowStatus.REFUNDED,
        escrowRefundedAt: new Date(),
        refundReason: dto.refundReason,
        status: PaymentStatus.REFUNDED,
      },
    });

    if (isTenant) {
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'ESCROW_REFUNDED',
          title: 'Escrow Refunded',
          message: `Your escrow payment of ${payment.amount} BDT has been refunded`,
          data: { paymentId: payment.id, amount: payment.amount },
        },
      });
    }

    return this.mapToResponse(updatedPayment);
  }

  async disputeEscrow(userId: string, dto: DisputeEscrowDto): Promise<EscrowResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { application: { include: { property: true, tenant: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException('Escrow is not in held status');
    }

    const isTenant = payment.application?.tenantId === userId;
    const isLandlord = payment.application?.property?.landlordId === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException('Only tenant or landlord can dispute escrow');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: {
        escrowStatus: EscrowStatus.DISPUTED,
        escrowDisputedAt: new Date(),
        releaseReason: dto.disputeReason,
      },
    });

    const otherUserId = isTenant ? payment.application?.property?.landlordId : payment.application?.tenantId;
    if (otherUserId) {
      await this.prisma.notification.create({
        data: {
          userId: otherUserId,
          type: 'ESCROW_DISPUTED',
          title: 'Escrow Disputed',
          message: `An escrow payment of ${payment.amount} BDT has been disputed`,
          data: { paymentId: payment.id, amount: payment.amount },
        },
      });
    }

    return this.mapToResponse(updatedPayment);
  }

  async resolveDispute(paymentId: string, adminId: string, resolution: 'release' | 'refund' | 'split', splitPercentage?: number): Promise<EscrowResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { application: { include: { property: true, tenant: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.escrowStatus !== EscrowStatus.DISPUTED) {
      throw new BadRequestException('Escrow is not in disputed status');
    }

    const isAdmin = await this.isUserAdmin(adminId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can resolve disputes');
    }

    let updateData: any = {};

    if (resolution === 'release') {
      const split = await this.calculateEscrowSplit(Number(payment.amount));
      updateData = {
        escrowStatus: EscrowStatus.RELEASED,
        escrowReleasedAt: new Date(),
        platformFee: split.platformFee,
        landlordAmount: split.landlordAmount,
        tenantAmount: split.tenantAmount,
        releaseReason: 'Dispute resolved in favor of landlord',
        status: PaymentStatus.COMPLETED,
      };
    } else if (resolution === 'refund') {
      updateData = {
        escrowStatus: EscrowStatus.REFUNDED,
        escrowRefundedAt: new Date(),
        refundReason: 'Dispute resolved in favor of tenant',
        status: PaymentStatus.REFUNDED,
      };
    } else if (resolution === 'split' && splitPercentage !== undefined) {
      const totalAmount = Number(payment.amount);
      const platformFee = this.calculatePlatformFee(totalAmount);
      const remainingAmount = totalAmount - platformFee;
      const landlordAmount = (remainingAmount * splitPercentage) / 100;
      const tenantAmount = remainingAmount - landlordAmount;

      updateData = {
        escrowStatus: EscrowStatus.PARTIALLY_RELEASED,
        escrowReleasedAt: new Date(),
        platformFee,
        landlordAmount,
        tenantAmount,
        releaseReason: `Dispute resolved with ${splitPercentage}% to landlord`,
        status: PaymentStatus.COMPLETED,
      };
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
    });

    if (payment.application?.tenantId) {
      await this.prisma.notification.create({
        data: {
          userId: payment.application.tenantId,
          type: 'ESCROW_RESOLVED',
          title: 'Escrow Dispute Resolved',
          message: `Your escrow dispute has been resolved: ${resolution}`,
          data: { paymentId: payment.id, resolution },
        },
      });
    }

    if (payment.application?.property?.landlordId) {
      await this.prisma.notification.create({
        data: {
          userId: payment.application.property.landlordId,
          type: 'ESCROW_RESOLVED',
          title: 'Escrow Dispute Resolved',
          message: `Your escrow dispute has been resolved: ${resolution}`,
          data: { paymentId: payment.id, resolution },
        },
      });
    }

    return this.mapToResponse(updatedPayment);
  }

  async calculateEscrowSplit(amount: number): Promise<{ platformFee: number; landlordAmount: number; tenantAmount: number }> {
    const platformFee = this.calculatePlatformFee(amount);
    const remainingAmount = amount - platformFee;
    const landlordAmount = remainingAmount;
    const tenantAmount = 0;

    return {
      platformFee: Math.round(platformFee * 100) / 100,
      landlordAmount: Math.round(landlordAmount * 100) / 100,
      tenantAmount: Math.round(tenantAmount * 100) / 100,
    };
  }

  private calculatePlatformFee(amount: number): number {
    return (amount * this.PLATFORM_FEE_PERCENTAGE / 100) + this.PLATFORM_FEE_FIXED;
  }

  private async isUserAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.name === 'ADMIN' || ur.role.name === 'SUPER_ADMIN');
  }

  private mapToResponse(payment: any): EscrowResponseDto {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      status: payment.status,
      escrowStatus: payment.escrowStatus,
      escrowReleasedAt: payment.escrowReleasedAt,
      escrowRefundedAt: payment.escrowRefundedAt,
      escrowDisputedAt: payment.escrowDisputedAt,
      platformFee: payment.platformFee?.toString(),
      landlordAmount: payment.landlordAmount?.toString(),
      tenantAmount: payment.tenantAmount?.toString(),
      releaseReason: payment.releaseReason,
      refundReason: payment.refundReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
