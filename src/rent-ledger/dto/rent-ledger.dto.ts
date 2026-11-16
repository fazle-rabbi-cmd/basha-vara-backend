import { IsUUID, IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';

export enum RentPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum UtilityChargeType {
  ELECTRICITY = 'ELECTRICITY',
  GAS = 'GAS',
  WATER = 'WATER',
  INTERNET = 'INTERNET',
  OTHER = 'OTHER',
}

export enum UtilityChargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export class CreateRentPaymentDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  tenantId: string;

  @IsNumber()
  amount: number;

  @IsDate()
  paymentDate: Date;

  @IsDate()
  dueDate: Date;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRentPaymentDto {
  @IsOptional()
  @IsEnum(RentPaymentStatus)
  status?: RentPaymentStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateUtilityChargeDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  tenantId: string;

  @IsEnum(UtilityChargeType)
  chargeType: UtilityChargeType;

  @IsNumber()
  amount: number;

  @IsString()
  billingMonth: string; // Format: YYYY-MM

  @IsDate()
  dueDate: Date;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateUtilityChargeDto {
  @IsOptional()
  @IsEnum(UtilityChargeStatus)
  status?: UtilityChargeStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RentPaymentResponseDto {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  amount: string;
  paymentDate: Date;
  dueDate: Date;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UtilityChargeResponseDto {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  chargeType: string;
  amount: string;
  billingMonth: string;
  dueDate: Date;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
