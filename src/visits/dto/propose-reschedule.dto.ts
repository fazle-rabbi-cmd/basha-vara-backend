import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProposeRescheduleDto {
  @ApiProperty({ example: '2026-12-05', description: 'New candidate date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '15:00', description: 'New candidate time (HH:mm or 03:00 PM)' })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiPropertyOptional({ example: 'I will be at the property on Saturday afternoon instead.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
