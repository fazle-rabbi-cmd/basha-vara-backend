import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyCheckInDto {
  @ApiProperty({ example: '482910', description: '6-digit check-in verification code displayed by tenant' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 numeric digits' })
  otp: string;

  @ApiPropertyOptional({ example: 23.7937, description: 'Optional GPS latitude at check-in' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 90.4066, description: 'Optional GPS longitude at check-in' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 15.5, description: 'GPS accuracy in meters' })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;
}
