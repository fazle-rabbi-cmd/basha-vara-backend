import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  leaseId?: string;

  @IsString()
  @IsOptional()
  visitId?: string;
}

export class ReviewResponseDto {
  id: string;
  reviewerId: string;
  revieweeId: string;
  propertyId: string;
  leaseId?: string;
  visitId?: string;
  rating: number;
  comment?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  reviewee?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  property?: {
    id: string;
    title: string;
  };
}
