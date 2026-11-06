import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
