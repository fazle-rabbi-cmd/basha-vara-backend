import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmVideoCallDto {
  @ApiPropertyOptional({ example: 15, description: 'Duration of the completed video call in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Discussed flat details, master bedroom, and parking space.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
