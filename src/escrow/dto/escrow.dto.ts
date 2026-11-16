import { IsEnum, IsNotEmpty, IsUUID, IsString, IsOptional, IsNumber } from 'class-validator';
import { EscrowStatus } from '@prisma/client';

export class EscrowActionDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ReleaseEscrowDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsOptional()
  releaseReason?: string;
}

export class RefundEscrowDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsOptional()
  refundReason?: string;
}

export class DisputeEscrowDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  disputeReason: string;
}

export class EscrowResponseDto {
  id: string;
  applicationId?: string;
  amount: string;
  paymentType: string;
  status: string;
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
