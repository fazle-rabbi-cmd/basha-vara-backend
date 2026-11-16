import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyStatus, PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  ValidateIf,
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

  @ApiPropertyOptional({ example: 23.8103, description: 'Latitude for map location' })
  @ValidateIf((dto) => dto.lat !== undefined || dto.lng !== undefined)
  @IsDefined({ message: 'Latitude and longitude must be provided together.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 90.4125, description: 'Longitude for map location' })
  @ValidateIf((dto) => dto.lat !== undefined || dto.lng !== undefined)
  @IsDefined({ message: 'Latitude and longitude must be provided together.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

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

  // Landlord Tenant Preferences
  @ApiPropertyOptional({ example: 'STUDENT', enum: ['STUDENT', 'WORKING', 'BOTH', 'ANY'], description: 'Allowed occupation type' })
  @IsOptional()
  @IsString()
  allowedOccupation?: string;

  @ApiPropertyOptional({ example: 'SINGLE', enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'ANY'], description: 'Allowed marital status' })
  @IsOptional()
  @IsString()
  allowedMaritalStatus?: string;

  @ApiPropertyOptional({ example: 'FAMILY', enum: ['FAMILY', 'BACHELOR', 'SUBLET', 'ANY'], description: 'Allowed family type' })
  @IsOptional()
  @IsString()
  allowedFamilyType?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, description: 'Maximum family size allowed' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFamilySize?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, description: 'Maximum total occupants (including children)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, description: 'Minimum age of youngest child allowed' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minChildrenAge?: number;

  @ApiPropertyOptional({ example: 17, minimum: 0, description: 'Maximum age of oldest child allowed' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxChildrenAge?: number;

  @ApiPropertyOptional({ example: true, description: 'Allow children under 2 (infants)' })
  @IsOptional()
  @IsBoolean()
  allowInfants?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Allow children 2-5 (toddlers)' })
  @IsOptional()
  @IsBoolean()
  allowToddlers?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Allow children 6-12 (school age)' })
  @IsOptional()
  @IsBoolean()
  allowSchoolAge?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Allow children 13-17 (teens)' })
  @IsOptional()
  @IsBoolean()
  allowTeens?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Allow pets' })
  @IsOptional()
  @IsBoolean()
  allowPets?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Allow smoking' })
  @IsOptional()
  @IsBoolean()
  allowSmoking?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Enforce strict return time' })
  @IsOptional()
  @IsBoolean()
  strictReturnTime?: boolean;

  @ApiPropertyOptional({ example: '23:00', description: 'Minimum return time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'minReturnTime must be in HH:MM format' })
  minReturnTime?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'Quiet hours start time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'quietHoursStart must be in HH:MM format' })
  quietHoursStart?: string;

  @ApiPropertyOptional({ example: '06:00', description: 'Quiet hours end time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'quietHoursEnd must be in HH:MM format' })
  quietHoursEnd?: string;

  @ApiPropertyOptional({ example: 'MALE', enum: ['MALE', 'FEMALE', 'ANY'], description: 'Preferred gender' })
  @IsOptional()
  @IsString()
  preferredGender?: string;
}
