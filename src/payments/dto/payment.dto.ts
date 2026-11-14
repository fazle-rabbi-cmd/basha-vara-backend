import { IsEnum, IsNotEmpty, IsUUID, IsString, IsDecimal, IsOptional } from 'class-validator';
import { PaymentType, PaymentStatus, EscrowStatus } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @IsEnum(PaymentType)
  @IsNotEmpty()
  paymentType: PaymentType;
}

export class PaymentResponseDto {
  id: string;
  applicationId?: string;
  amount: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  transactionId?: string;
  paidAt?: Date;
  escrowStatus: EscrowStatus;
  escrowReleasedAt?: Date;
  escrowRefundedAt?: Date;
  escrowDisputedAt?: Date;
  platformFee?: string;
  landlordAmount?: string;
  tenantAmount?: string;
  releaseReason?: string;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class StripePaymentIntentDto {
  clientSecret: string;
  amount: number;
  currency: string;
  paymentId: string;
}
