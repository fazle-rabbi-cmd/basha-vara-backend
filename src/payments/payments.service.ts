import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePaymentDto, PaymentResponseDto, StripePaymentIntentDto } from './dto/payment.dto.js';
import { PaymentType, PaymentStatus, EscrowStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async initiatePayment(userId: string, dto: CreatePaymentDto): Promise<StripePaymentIntentDto> {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: dto.applicationId },
      include: { property: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.tenantId !== userId) {
      throw new BadRequestException('You can only initiate payments for your own applications');
    }

    if (application.status !== 'SELECTED') {
      throw new BadRequestException('Payment can only be initiated for selected applications');
    }

    const amount = dto.paymentType === 'SECURITY_DEPOSIT'
      ? application.property.depositAmount
      : application.property.rentAmount;

    if (!amount) {
      throw new BadRequestException('Amount not available for this payment type');
    }

    const payment = await this.prisma.payment.create({
      data: {
        applicationId: dto.applicationId,
        amount,
        paymentType: dto.paymentType,
        status: PaymentStatus.PENDING,
      },
    });

    const paymentIntentId = `pi_${payment.id}`;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: paymentIntentId },
    });

    return {
      clientSecret: `pi_${payment.id}_secret_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency: 'bdt',
      paymentId: payment.id,
    };
  }

  async confirmPayment(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { application: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return this.mapToResponse(payment);
    }

    const shouldHoldInEscrow = payment.paymentType === PaymentType.SECURITY_DEPOSIT ||
                               payment.paymentType === PaymentType.FIRST_MONTH_RENT;

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        escrowStatus: shouldHoldInEscrow ? EscrowStatus.HELD : EscrowStatus.NOT_APPLICABLE,
      },
    });

    return this.mapToResponse(updatedPayment);
  }

  async getPaymentByApplication(applicationId: string): Promise<PaymentResponseDto[]> {
    const payments = await this.prisma.payment.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.mapToResponse(p));
  }

  async getPaymentById(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponse(payment);
  }

  async initiateBookingDeposit(userId: string, visitId: string, amount: number): Promise<StripePaymentIntentDto> {
    const visit = await this.prisma.visitRequest.findUnique({
      where: { id: visitId },
      include: { property: true },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (visit.tenantId !== userId) {
      throw new BadRequestException('You can only initiate payments for your own visits');
    }

    if (visit.status !== 'ACCEPTED') {
      throw new BadRequestException('Booking deposit can only be initiated for accepted visits');
    }

    const payment = await this.prisma.payment.create({
      data: {
        visitRequestId: visitId,
        amount,
        paymentType: PaymentType.BOOKING_DEPOSIT,
        status: PaymentStatus.PENDING,
      },
    });

    const paymentIntentId = `pi_${payment.id}`;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: paymentIntentId },
    });

    return {
      clientSecret: `pi_${payment.id}_secret_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency: 'bdt',
      paymentId: payment.id,
    };
  }

  private mapToResponse(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      amount: payment.amount.toString(),
      paymentType: payment.paymentType,
      status: payment.status,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
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
