import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VisitType } from './create-visit-request.dto.js';

export class UpdateVisitRequestDto {
  @ApiPropertyOptional({ example: '2026-11-05T00:00:00.000Z', description: 'Proposed date for the visit' })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  requestedDate?: Date;

  @ApiPropertyOptional({ example: '3:30 PM', description: 'Preferred time slot for the visit' })
  @IsOptional()
  @IsString()
  requestedTime?: string;

  @ApiPropertyOptional({ example: 'I would like to inspect the master bedroom and balcony ventilation.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    enum: VisitType,
    example: VisitType.IN_PERSON,
    description: 'Type of visit',
  })
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  @ApiPropertyOptional({
    example: 2,
    description: 'Number of guests attending the visit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({
    example: '+8801712345678',
    description: 'Contact phone number for the visit',
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}
