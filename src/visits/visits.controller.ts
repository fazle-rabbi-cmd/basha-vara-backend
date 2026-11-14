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
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { SystemPermission } from '@prisma/client';

@ApiTags('Visits')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Patch(':id/status')
  @RequirePermissions(SystemPermission.VISIT_UPDATE_OWN)
  @ApiOperation({ summary: 'Update visit request status (accept, decline, cancel, or complete)' })
  @ApiResponse({ status: 200, description: 'Visit status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisitStatusDto,
  ) {
    return this.visitsService.updateStatus(id, user.id, user.roles, dto);
  }

  @Post(':id/generate-otp')
  @ApiOperation({ summary: 'Generate OTP for visit verification' })
  @ApiResponse({ status: 200, description: 'OTP generated successfully' })
  async generateOtp(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { role: 'landlord' | 'tenant' },
  ) {
    return this.visitsService.generateOtp(id, user.id, dto.role);
  }

  @Post(':id/verify-otp')
  @ApiOperation({ summary: 'Verify OTP for visit' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  async verifyOtp(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { role: 'landlord' | 'tenant'; otp: string },
  ) {
    return this.visitsService.verifyOtp(id, user.id, dto.role, dto.otp);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete visit after OTP verification' })
  @ApiResponse({ status: 200, description: 'Visit completed successfully' })
  async completeVisit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.visitsService.completeVisit(id, user.id);
  }

  @Post(':id/token-hold')
  @ApiOperation({ summary: 'Initiate token hold payment to lock property' })
  @ApiResponse({ status: 200, description: 'Token hold initiated successfully' })
  async initiateTokenHold(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { amount: number },
  ) {
    return this.visitsService.initiateTokenHold(id, user.id, dto.amount);
  }

  @Post(':id/lock-property')
  @ApiOperation({ summary: 'Lock property for token hold period' })
  @ApiResponse({ status: 200, description: 'Property locked successfully' })
  async lockProperty(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.visitsService.lockProperty(id, user.id);
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
