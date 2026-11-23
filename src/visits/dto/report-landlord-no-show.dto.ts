import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReportLandlordNoShowDto {
  @ApiPropertyOptional({ example: 'Waited at building gate for 45 minutes, landlord was unreachable by phone.' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'https://storage.bashavara.com/evidence/tenant-gate-photo.jpg' })
  @IsOptional()
  @IsString()
  evidencePhotoUrl?: string;
}
