import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApplicationProfilesService } from './application-profiles.service.js';
import { CreateApplicationProfileDto } from './dto/create-application-profile.dto.js';
import { UpdateApplicationProfileDto } from './dto/update-application-profile.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Application Profiles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('me/application-profile')
export class ApplicationProfilesController {
  constructor(private readonly applicationProfilesService: ApplicationProfilesService) {}

  @Get()
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get current user application profile' })
  @ApiResponse({ status: 200, description: 'Application profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Application profile not found' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.applicationProfilesService.findByUserId(userId);
  }

  @Post()
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create application profile for current user' })
  @ApiResponse({ status: 201, description: 'Application profile created successfully' })
  @ApiResponse({ status: 400, description: 'Application profile already exists' })
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateApplicationProfileDto,
  ) {
    return this.applicationProfilesService.create(userId, dto);
  }

  @Patch()
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update current user application profile' })
  @ApiResponse({ status: 200, description: 'Application profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Application profile not found' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateApplicationProfileDto,
  ) {
    return this.applicationProfilesService.update(userId, dto);
  }
}
