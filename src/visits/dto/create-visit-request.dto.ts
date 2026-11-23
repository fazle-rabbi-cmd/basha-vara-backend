import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum VisitType {
  IN_PERSON = 'IN_PERSON',
  VIDEO_CALL = 'VIDEO_CALL',
}

export class ProposedSlotDto {
  @ApiProperty({ example: '2026-12-01', description: 'Proposed date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '14:30', description: 'Proposed time (HH:mm or 10:00 AM)' })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiPropertyOptional({ example: 0, description: 'Candidate slot index' })
  @IsOptional()
  @IsNumber()
  slotIndex?: number;
}

export class CreateVisitRequestDto {
  @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z', description: 'Primary requested date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedDate?: Date;

  @ApiPropertyOptional({ example: '10:00 AM', description: 'Primary requested time' })
  @IsOptional()
  @IsString()
  requestedTime?: string;

  @ApiPropertyOptional({
    type: [ProposedSlotDto],
    description: '1 to 3 candidate slots proposed by tenant',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposedSlotDto)
  proposedSlots?: ProposedSlotDto[];

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
