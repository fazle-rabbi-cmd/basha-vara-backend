import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationMatrixService } from './notification-matrix.service.js';
import { UpdateNotificationPreferenceDto, NotificationPreferenceResponseDto } from './dto/notification-preference.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Notification Preferences')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly notificationMatrixService: NotificationMatrixService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notification preferences for current user' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully', type: [NotificationPreferenceResponseDto] })
  async getPreferences(
    @CurrentUser() user: any,
  ): Promise<NotificationPreferenceResponseDto[]> {
    return this.notificationMatrixService.getUserPreferences(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update notification preference' })
  @ApiResponse({ status: 200, description: 'Preference updated successfully', type: NotificationPreferenceResponseDto })
  async updatePreference(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationMatrixService.updateUserPreference(
      user.id,
      dto.notificationType,
      dto.channel,
      dto.enabled,
    );
  }

  @Get('matrix')
  @ApiOperation({ summary: 'Get notification matrix (admin only)' })
  @ApiResponse({ status: 200, description: 'Notification matrix retrieved successfully' })
  async getMatrix(): Promise<any[]> {
    return this.notificationMatrixService.getAllMatrixEntries();
  }
}
