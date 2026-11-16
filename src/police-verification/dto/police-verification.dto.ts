import { IsUUID, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class GeneratePoliceVerificationDto {
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

  @IsUUID()
  @IsOptional()
  applicationId?: string;
}

export class PoliceVerificationResponseDto {
  id: string;
  tenantId: string;
  propertyId: string;
  applicationId?: string;
  landlordId: string;
  status: string;
  formData: any;
  pdfUrl?: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
