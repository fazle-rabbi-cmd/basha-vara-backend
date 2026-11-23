import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class CreateRentPaymentDto {
  @IsString()
  @IsNotEmpty()
  leaseId: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AcknowledgePaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}

export class DisputePaymentDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RentPaymentResponseDto {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  leaseId?: string;
  amount: string;
  paymentDate: Date;
  dueDate: Date;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  disputeReason?: string;
  createdAt: Date;
  updatedAt: Date;
  tenant?: {
    id: string;
    fullName: string;
    email: string;
  };
  landlord?: {
    id: string;
    fullName: string;
  };
  property?: {
    id: string;
    title: string;
  };
}
