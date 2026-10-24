import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  @IsOptional()
  @IsString()
  occupation?: string;

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
