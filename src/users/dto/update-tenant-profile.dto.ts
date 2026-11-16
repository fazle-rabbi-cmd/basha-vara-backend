import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: 'SINGLE', enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  moveInDatePreference?: Date;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  householdSize?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasChildren?: boolean;

  @ApiPropertyOptional({ example: 2, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, description: 'Age of youngest child' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  youngestChildAge?: number;

  @ApiPropertyOptional({ example: 10, minimum: 0, description: 'Age of oldest child' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  oldestChildAge?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasPets?: boolean;

  @ApiPropertyOptional({ example: 'DOG', enum: ['DOG', 'CAT', 'BIRD', 'OTHER'] })
  @IsOptional()
  @IsString()
  petType?: string;

  @ApiPropertyOptional({ example: 'NON_SMOKER', enum: ['SMOKER', 'NON_SMOKER', 'OCCASIONAL'] })
  @IsOptional()
  @IsString()
  smokingStatus?: string;

  @ApiPropertyOptional({ example: '23:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'returnTimePreference must be in HH:MM format' })
  returnTimePreference?: string;

  @ApiPropertyOptional({ example: 'MALE', enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: ['Dhanmondi', 'Mirpur DOHS', 'Lalmatia'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLocations?: string[];

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ enum: PropertyType, isArray: true, example: [PropertyType.APARTMENT, PropertyType.FLAT] })
  @IsOptional()
  @IsArray()
  @IsEnum(PropertyType, { each: true })
  preferredPropertyTypes?: PropertyType[];

  @ApiPropertyOptional({ example: 'Looking for a peaceful, well-ventilated apartment with generator backup.' })
  @IsOptional()
  @IsString()
  bio?: string;
}
