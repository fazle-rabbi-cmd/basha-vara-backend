import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContactVisibility, ContactMilestone } from '@prisma/client';

export class UpdateContactPrivacyDto {
  @ApiProperty({ enum: ContactVisibility, required: false })
  @IsEnum(ContactVisibility)
  @IsOptional()
  emailVisibility?: ContactVisibility;

  @ApiProperty({ enum: ContactVisibility, required: false })
  @IsEnum(ContactVisibility)
  @IsOptional()
  phoneVisibility?: ContactVisibility;

  @ApiProperty({ enum: ContactMilestone, required: false })
  @IsEnum(ContactMilestone)
  @IsOptional()
  revealContactAfterMilestone?: ContactMilestone;
}
