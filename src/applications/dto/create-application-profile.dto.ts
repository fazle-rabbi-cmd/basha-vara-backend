import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateApplicationProfileDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full legal name',
  })
  @IsString()
  fullName: string;

  @ApiProperty({
    example: '+8801712345678',
    description: 'Contact phone number',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Contact email address',
  })
  @IsString()
  email: string;

  @ApiProperty({
    example: 'Employed',
    description: 'Current employment status',
  })
  @IsString()
  employmentStatus: string;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Monthly income in BDT',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyIncome?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the applicant has pets',
  })
  @IsOptional()
  @IsBoolean()
  hasPets?: boolean;

  @ApiPropertyOptional({
    example: 'One small dog, 5 years old',
    description: 'Details about pets if any',
  })
  @IsOptional()
  @IsString()
  petDetails?: string;

  @ApiPropertyOptional({
    example: 'Jane Doe',
    description: 'Emergency contact name',
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({
    example: '+8801812345678',
    description: 'Emergency contact phone number',
  })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({
    example: [{ name: 'Previous Landlord', phone: '+8801912345678', relationship: 'Landlord' }],
    description: 'Reference contacts',
  })
  @IsOptional()
  references?: any;
}
