import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VisitDeclineReasonCode } from '../domain/visit.types.js';

export class DeclineVisitDto {
  @ApiProperty({
    enum: VisitDeclineReasonCode,
    example: VisitDeclineReasonCode.SCHEDULING_CONFLICT,
    description: 'Structured reason code for declining visit request',
  })
  @IsEnum(VisitDeclineReasonCode)
  @IsNotEmpty()
  reasonCode: VisitDeclineReasonCode;

  @ApiPropertyOptional({ example: 'I am unavailable during this entire week due to renovation.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
