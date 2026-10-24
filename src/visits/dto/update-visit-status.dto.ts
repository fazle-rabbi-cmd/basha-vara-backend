import { ApiProperty } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateVisitStatusDto {
  @ApiProperty({
    enum: VisitStatus,
    example: VisitStatus.ACCEPTED,
    description: 'Updated status of the visit request',
  })
  @IsEnum(VisitStatus)
  status: VisitStatus;
}
