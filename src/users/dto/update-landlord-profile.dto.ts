import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLandlordProfileDto {
  @ApiPropertyOptional({ example: 'Rahim Properties Ltd.' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ example: 'WhatsApp preferred: +8801712345678' })
  @IsOptional()
  @IsString()
  contactPreference?: string;

  @ApiPropertyOptional({ example: 'Experienced property owner maintaining verified flats in Dhanmondi.' })
  @IsOptional()
  @IsString()
  bio?: string;
}
