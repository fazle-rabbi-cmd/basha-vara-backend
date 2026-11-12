import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum VisitType {
  IN_PERSON = 'IN_PERSON',
  VIDEO_CALL = 'VIDEO_CALL',
}

export class CreateVisitRequestDto {
  @ApiProperty({ example: '2026-11-05T00:00:00.000Z', description: 'Proposed date for the visit' })
  @Type(() => Date)
  @IsDate()
  requestedDate: Date;

  @ApiProperty({ example: '3:30 PM', description: 'Preferred time slot for the visit' })
  @IsString()
  @IsNotEmpty()
  requestedTime: string;

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
