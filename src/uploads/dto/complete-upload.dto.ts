import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteUploadDto {
  @ApiProperty({ description: 'Property ID' })
  @IsString()
  @MaxLength(36)
  propertyId: string;

  @ApiProperty({ description: 'Storage key from intent' })
  @IsString()
  storageKey: string;

  @ApiProperty({ description: 'Caption for the photo (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @ApiProperty({ description: 'Mark as primary photo (optional)' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({ description: 'Sort order (optional)' })
  @IsOptional()
  sortIndex?: number;
}
