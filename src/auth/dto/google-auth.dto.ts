import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google OAuth ID token (credential from Google Identity Services)',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  credential: string;

  @ApiProperty({ enum: [Role.TENANT, Role.LANDLORD], required: false })
  @IsOptional()
  @IsIn([Role.TENANT, Role.LANDLORD])
  role?: Role;
}
