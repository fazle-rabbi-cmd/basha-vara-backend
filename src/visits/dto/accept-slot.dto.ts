import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AcceptSlotDto {
  @ApiPropertyOptional({ example: 0, description: 'Index of candidate slot to accept (0, 1, or 2)' })
  @IsOptional()
  @IsNumber()
  slotIndex?: number;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Explicit confirmed date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  confirmedDate?: string;

  @ApiPropertyOptional({ example: '14:30', description: 'Explicit confirmed time (HH:mm)' })
  @IsOptional()
  @IsString()
  confirmedTime?: string;
}
