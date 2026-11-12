import { ApiProperty } from '@nestjs/swagger';
import { AmenityCategory } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCustomAmenityDto {
  @ApiProperty({ example: '24/7 Security Guard', description: 'Name of the custom amenity' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: AmenityCategory, default: AmenityCategory.UTILITY, description: 'Category for the amenity' })
  @IsEnum(AmenityCategory)
  category: AmenityCategory;
}
