import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto.js';
import { UpdateLandlordProfileDto } from './dto/update-landlord-profile.dto.js';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and role details' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update basic user account info (name, phone, avatar)' })
  @ApiResponse({ status: 200, description: 'User account updated successfully' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(userId, dto);
  }

  @Patch('me/tenant-profile')
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Update tenant preferences and search criteria' })
  @ApiResponse({ status: 200, description: 'Tenant profile updated successfully' })
  async updateTenantProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.usersService.updateTenantProfile(userId, dto);
  }

  @Patch('me/landlord-profile')
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiOperation({ summary: 'Update landlord profile and contact details' })
  @ApiResponse({ status: 200, description: 'Landlord profile updated successfully' })
  async updateLandlordProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLandlordProfileDto,
  ) {
    return this.usersService.updateLandlordProfile(userId, dto);
  }
}
