import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PropertyStatus, Role, UserStatus } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Platform operational overview and statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'High-level counts of properties, users, visits, and applications' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('properties')
  @ApiOperation({ summary: 'List all properties for moderation (Admin only)' })
  @ApiQuery({ name: 'status', enum: PropertyStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async getProperties(
    @Query('status') status?: PropertyStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getProperties({ status, search });
  }

  @Patch('properties/:id/status')
  @ApiOperation({ summary: 'Override property status (Approve, Pause, Suspend, Archive) (Admin only)' })
  async updatePropertyStatus(
    @Param('id') id: string,
    @Body('status') status: PropertyStatus,
  ) {
    return this.adminService.updatePropertyStatus(id, status);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all platform users with role and activity metadata (Admin only)' })
  @ApiQuery({ name: 'role', enum: Role, required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async getUsers(
    @Query('role') role?: Role,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({ role, status, search });
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Suspend or activate user account (Admin only)' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    return this.adminService.updateUserStatus(id, status);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Grant role to user account (Admin only)' })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.adminService.updateUserRole(id, role);
  }
}
