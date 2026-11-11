import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PropertyStatus, UserStatus } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
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
  @ApiQuery({ name: 'role', type: String, required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async getUsers(
    @Query('role') role?: string,
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
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Grant role to user account (Super Admin only)' })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all system permissions (Admin only)' })
  async getPermissions() {
    return this.adminService.getPermissions();
  }

  @Get('roles')
  @ApiOperation({ summary: 'List all roles with their permissions (Admin only)' })
  async getRoles() {
    return this.adminService.getRoles();
  }

  @Patch('roles/:roleId/permissions')
  @ApiOperation({ summary: 'Update permissions for a role (Admin only)' })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    return this.adminService.updateRolePermissions(roleId, permissionIds);
  }

  @Post('roles')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new role (Super Admin only)' })
  async createRole(
    @Body('name') name: string,
    @Body('displayName') displayName: string,
    @Body('description') description?: string,
    @Body('permissionIds') permissionIds?: string[],
  ) {
    return this.adminService.createRole(name, displayName, description, permissionIds);
  }

  @Patch('roles/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a role (Super Admin only)' })
  async updateRole(
    @Param('id') id: string,
    @Body('displayName') displayName?: string,
    @Body('description') description?: string,
  ) {
    return this.adminService.updateRole(id, displayName, description);
  }

  @Delete('roles/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a role (Super Admin only)' })
  async deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  @Delete('users/:userId/roles/:roleName')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Remove a role from a user (Super Admin only)' })
  async removeUserRole(
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
  ) {
    return this.adminService.removeUserRole(userId, roleName);
  }

  @Post('users')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new user with auto-generated password (Super Admin only)' })
  async createUser(
    @Body('email') email: string,
    @Body('fullName') fullName: string,
    @Body('role') role: string,
    @Body('phone') phone?: string,
  ) {
    return this.adminService.createUser(email, fullName, phone, role);
  }

  @Post('users/:id/reset-password')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reset user password with auto-generated password (Super Admin only)' })
  async resetUserPassword(@Param('id') id: string) {
    return this.adminService.resetUserPassword(id);
  }
}
