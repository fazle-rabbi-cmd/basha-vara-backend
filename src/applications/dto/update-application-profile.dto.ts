import { PartialType } from '@nestjs/swagger';
import { CreateApplicationProfileDto } from './create-application-profile.dto.js';

export class UpdateApplicationProfileDto extends PartialType(CreateApplicationProfileDto) {}
