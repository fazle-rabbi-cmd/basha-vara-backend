import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum DeviceType {
  WEB = 'web',
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(DeviceType)
  deviceType: DeviceType;

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class PushNotificationResponseDto {
  id: string;
  userId: string;
  token: string;
  deviceType: string;
  deviceName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SendPushNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  data?: string;
}
