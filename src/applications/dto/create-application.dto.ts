import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentalApplicationDto {
  @ApiPropertyOptional({
    example: 'We are a quiet family of 3 with no pets, planning for long-term stay.',
    description: 'Personal introduction and note to landlord',
  })
  @IsOptional()
  @IsString()
  coverNote?: string;

  @ApiPropertyOptional({
    example: '2026-12-01T00:00:00.000Z',
    description: 'Preferred lease commencement date',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  moveInDate?: Date;

  @ApiPropertyOptional({
    example: 35000,
    description: 'Proposed monthly rent offer in BDT',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proposedRent?: number;
}
