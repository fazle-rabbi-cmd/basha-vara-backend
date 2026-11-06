import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service.js';
import { CreateRentalApplicationDto } from './dto/create-application.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update rental application status (shortlist, reject, withdraw, or select final tenant)',
  })
  @ApiResponse({ status: 200, description: 'Application status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(id, user.id, user.roles, dto);
  }
}

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('me/applications')
export class TenantApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Get all rental applications submitted by current tenant' })
  @ApiResponse({ status: 200, description: 'List of submitted tenant rental applications' })
  async getMyApplications(@CurrentUser('id') tenantId: string) {
    return this.applicationsService.findTenantApplications(tenantId);
  }
}

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('landlord/applications')
export class LandlordApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiOperation({ summary: 'Get all rental applications submitted for landlord properties' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Filter by specific property ID' })
  @ApiResponse({ status: 200, description: 'List of applicants with tenant profile details' })
  async getLandlordApplications(
    @CurrentUser('id') landlordId: string,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.applicationsService.findLandlordApplications(landlordId, propertyId);
  }
}

@ApiTags('Applications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties/:propertyId/applications')
export class PropertyApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Submit a formal rental application for a property (Tenant)' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  @ApiResponse({ status: 400, description: 'Duplicate active application or property not accepting applications' })
  async createApplication(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') tenantId: string,
    @Body() dto: CreateRentalApplicationDto,
  ) {
    return this.applicationsService.create(propertyId, tenantId, dto);
  }
}
