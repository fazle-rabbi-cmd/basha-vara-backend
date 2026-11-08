import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export enum UploadType {
  PROPERTY_PHOTO = 'property_photo',
  PROFILE_PHOTO = 'profile_photo',
}

export class CreateUploadIntentDto {
  @ApiProperty({ enum: UploadType, description: 'Type of file to upload' })
  @IsEnum(UploadType)
  type: UploadType;

  @ApiProperty({ description: 'Property ID (required for property photos)', required: false })
  @IsString()
  @MaxLength(36)
  propertyId?: string;

  @ApiProperty({ description: 'File MIME type', example: 'image/jpeg' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes', example: 5242880 })
  @IsString()
  fileSize: string;
}
