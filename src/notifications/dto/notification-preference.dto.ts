import { IsString, IsNotEmpty, IsBoolean, IsEnum } from 'class-validator';
import { NotificationType } from '@prisma/client';
import { NotificationChannel } from '../notification-matrix.service.js';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsBoolean()
  enabled: boolean;
}

export class NotificationPreferenceResponseDto {
  id: string;
  userId: string;
  notificationType: NotificationType;
  channel: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
