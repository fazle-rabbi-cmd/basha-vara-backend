import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyStatus, PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';

export class PropertyPhotoInputDto {
  @ApiProperty({ example: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ example: 'Living Room' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Spacious 3-Bedroom Family Flat in Dhanmondi' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Well-ventilated south-facing apartment with backup generator and 24/7 security.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: PropertyType, example: PropertyType.APARTMENT })
  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @ApiProperty({ example: 35000, description: 'Monthly rent in BDT' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rentAmount: number;

  @ApiPropertyOptional({ example: 70000, description: 'Advance/Security deposit amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiProperty({ example: 3, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms: number;

  @ApiProperty({ example: 3, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bathrooms: number;

  @ApiPropertyOptional({ example: 1650, description: 'Total floor area in square feet' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  areaSqft?: number;

  @ApiPropertyOptional({ example: 4, description: 'Floor number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @ApiPropertyOptional({ example: 7, description: 'Total floors in building' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalFloors?: number;

  @ApiProperty({ example: 'House 42, Road 8A, Dhanmondi' })
  @IsString()
  @IsNotEmpty()
  addressLine: string;

  @ApiProperty({ example: 'Dhanmondi' })
  @IsString()
  @IsNotEmpty()
  area: string;

  @ApiPropertyOptional({ example: 'Dhaka', default: 'Dhaka' })
  @IsOptional()
  @IsString()
  city?: string = 'Dhaka';

  @ApiPropertyOptional({ example: 'Dhaka', default: 'Dhaka' })
  @IsOptional()
  @IsString()
  district?: string = 'Dhaka';

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  availableFrom: Date;

  @ApiPropertyOptional({ enum: PropertyStatus, default: PropertyStatus.DRAFT })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus = PropertyStatus.DRAFT;

  @ApiPropertyOptional({ type: [PropertyPhotoInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyPhotoInputDto)
  photos?: PropertyPhotoInputDto[];

  @ApiPropertyOptional({
    example: ['uuid-of-amenity-1', 'uuid-of-amenity-2'],
    description: 'List of Amenity UUIDs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityIds?: string[];
}
