import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VisitsService } from './visits.service.js';
import { CreateVisitRequestDto } from './dto/create-visit-request.dto.js';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { OwnershipGuard } from '../common/guards/ownership.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { RequireOwnership } from '../common/decorators/ownership.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { SystemPermission } from '@prisma/client';

@ApiTags('Visits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, OwnershipGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Patch(':id/status')
  @RequirePermissions(SystemPermission.VISIT_UPDATE_OWN)
  @RequireOwnership('visit', 'id')
  @ApiOperation({ summary: 'Update visit request status (accept, decline, cancel, or complete)' })
  @ApiResponse({ status: 200, description: 'Visit status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisitStatusDto,
  ) {
    return this.visitsService.updateStatus(id, user.id, user.roles, dto);
  }
}

@ApiTags('Visits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('me/visits')
export class TenantVisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all visit requests submitted by current tenant' })
  @ApiResponse({ status: 200, description: 'List of tenant visit requests' })
  async getMyVisits(@CurrentUser('id') tenantId: string) {
    return this.visitsService.findTenantVisits(tenantId);
  }
}

@ApiTags('Visits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('landlord/visits')
export class LandlordVisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @Roles('LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all visit requests submitted for landlord properties' })
  @ApiResponse({ status: 200, description: 'List of landlord property visit requests' })
  async getLandlordVisits(@CurrentUser('id') landlordId: string) {
    return this.visitsService.findLandlordVisits(landlordId);
  }
}

@ApiTags('Visits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('properties/:propertyId/visits')
export class PropertyVisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @RequirePermissions(SystemPermission.VISIT_CREATE)
  @ApiOperation({ summary: 'Submit a physical property visit request (Tenant)' })
  @ApiResponse({ status: 201, description: 'Visit request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Duplicate pending visit or self-booking attempt' })
  async createVisit(
    @Param('propertyId') propertyId: string,
    @CurrentUser('id') tenantId: string,
    @Body() dto: CreateVisitRequestDto,
  ) {
    return this.visitsService.create(propertyId, tenantId, dto);
  }
}
