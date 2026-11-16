import { IsEnum, IsNotEmpty, IsUUID, IsString, IsDate, IsDecimal, IsOptional, IsJSON } from 'class-validator';
import { LeaseStatus } from '@prisma/client';

export class CreateLeaseAgreementDto {
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @IsString()
  @IsOptional()
  terms?: string;
}

export class UpdateLeaseAgreementDto {
  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;

  @IsString()
  @IsOptional()
  landlordSignatureData?: string;

  @IsString()
  @IsOptional()
  tenantSignatureData?: string;
}

export class LeaseAgreementResponseDto {
  id: string;
  applicationId: string;
  landlordId: string;
  tenantId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  rentAmount: string;
  depositAmount: string;
  terms: any;
  status: LeaseStatus;
  landlordSigned: boolean;
  tenantSigned: boolean;
  signedAt?: Date;
  pdfUrl?: string;
  landlordSignatureData?: string;
  tenantSignatureData?: string;
  createdAt: Date;
  updatedAt: Date;
}
