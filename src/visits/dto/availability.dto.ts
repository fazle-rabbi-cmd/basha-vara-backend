import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class AvailabilityWindowItemDto {
  @ApiProperty({ example: 0, description: 'Day of week: 0 (Sun) to 6 (Sat)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '10:00', description: 'Window start time (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '18:00', description: 'Window end time (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({ example: true, description: 'Whether window is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetPropertyAvailabilityDto {
  @ApiProperty({ type: [AvailabilityWindowItemDto], description: 'List of availability windows for the listing' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowItemDto)
  windows: AvailabilityWindowItemDto[];
}
