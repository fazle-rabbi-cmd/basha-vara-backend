import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ListingVerificationStatus } from '@prisma/client';

export class ListingVerificationDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  documentType: string; // OWNERSHIP_DEED, UTILITY_BILL, OTHER

  @IsString()
  @IsNotEmpty()
  documentUrl: string;
}

export class ReviewVerificationDto {
  @IsEnum(ListingVerificationStatus)
  status: ListingVerificationStatus;

  @IsString()
  rejectionReason?: string;
}

export class ListingVerificationResponseDto {
  id: string;
  propertyId: string;
  landlordId: string;
  documentType: string;
  documentUrl: string;
  status: ListingVerificationStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  property?: {
    id: string;
    title: string;
    addressLine: string;
    area: string;
    city: string;
  };
  landlord?: {
    id: string;
    fullName: string;
    email: string;
  };
}
