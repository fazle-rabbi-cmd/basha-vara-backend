import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum DocumentType {
  ID = 'id',
  INCOME = 'income',
  EMPLOYMENT = 'employment',
  REFERENCE = 'reference',
  RENTAL_HISTORY = 'rental_history',
}

export class UploadApplicationDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    example: DocumentType.ID,
    description: 'Type of document being uploaded',
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    example: 'national_id.pdf',
    description: 'Original file name',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    example: 'properties/application-documents/abc123/national_id.pdf',
    description: 'Storage key from Supabase',
  })
  @IsString()
  storageKey: string;

  @ApiProperty({
    example: 1024000,
    description: 'File size in bytes',
  })
  @IsString()
  fileSize: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME type of the file',
  })
  @IsString()
  mimeType: string;
}
