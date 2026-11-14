import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PushNotificationsService } from './push-notifications.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RegisterDeviceTokenDto, PushNotificationResponseDto } from './dto/push-notification.dto.js';

@ApiTags('Push Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly pushNotificationsService: PushNotificationsService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Device token registered successfully', type: PushNotificationResponseDto })
  async registerDeviceToken(
    @CurrentUser() user: any,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<PushNotificationResponseDto> {
    return this.pushNotificationsService.registerDeviceToken(user.id, dto);
  }

  @Delete('unregister')
  @ApiOperation({ summary: 'Unregister device token' })
  @ApiResponse({ status: 200, description: 'Device token unregistered successfully' })
  async unregisterDeviceToken(
    @CurrentUser() user: any,
    @Body() body: { token: string },
  ): Promise<void> {
    return this.pushNotificationsService.unregisterDeviceToken(user.id, body.token);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get user device tokens' })
  @ApiResponse({ status: 200, description: 'Device tokens retrieved successfully', type: [PushNotificationResponseDto] })
  async getUserDeviceTokens(
    @CurrentUser() user: any,
  ): Promise<PushNotificationResponseDto[]> {
    return this.pushNotificationsService.getUserDeviceTokens(user.id);
  }
}
