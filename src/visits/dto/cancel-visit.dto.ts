import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelVisitDto {
  @ApiPropertyOptional({ example: 'Personal emergency came up.', description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
