import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google OAuth ID token (credential from Google Identity Services)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  credential: string;

  @ApiProperty({ example: 'TENANT', required: false })
  @IsOptional()
  @IsIn(['TENANT', 'LANDLORD'])
  role?: string;
}
