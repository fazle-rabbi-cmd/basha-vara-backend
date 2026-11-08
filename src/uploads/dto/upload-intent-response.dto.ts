import { ApiProperty } from '@nestjs/swagger';

export class UploadIntentResponseDto {
  @ApiProperty({ description: 'Unique upload ID for tracking' })
  uploadId: string;

  @ApiProperty({ description: 'Signed upload URL (expires in 15 minutes)' })
  uploadUrl: string;

  @ApiProperty({ description: 'Storage key for the file' })
  storageKey: string;

  @ApiProperty({ description: 'Public URL for the uploaded file (after completion)' })
  publicUrl: string;

  @ApiProperty({ description: 'Expiration timestamp for the signed URL' })
  expiresAt: string;
}
