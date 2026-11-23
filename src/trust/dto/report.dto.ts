import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  targetType: string; // LISTING, USER, MESSAGE

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ResolveReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsString()
  @IsOptional()
  resolution?: string;
}

export class ReportResponseDto {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  reporter?: {
    id: string;
    fullName: string;
    email: string;
  };
  resolver?: {
    id: string;
    fullName: string;
  };
}
