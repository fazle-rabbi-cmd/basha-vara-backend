import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RespondRescheduleDto {
  @ApiProperty({ example: true, description: 'Whether tenant accepts (true) or declines (false) the proposed slot' })
  @IsBoolean()
  @IsNotEmpty()
  accept: boolean;

  @ApiPropertyOptional({ example: 'This time does not fit my work schedule.' })
  @IsOptional()
  @IsString()
  declineReason?: string;
}
