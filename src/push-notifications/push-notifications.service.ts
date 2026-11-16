import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDeviceTokenDto, SendPushNotificationDto, PushNotificationResponseDto } from './dto/push-notification.dto.js';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { cert } from 'firebase-admin/app';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private firebaseApp?: App;
  private messaging?: Messaging;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const projectId = this.configService.get('FIREBASE_PROJECT_ID');
      const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
      const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn('Firebase credentials not configured - push notifications disabled');
        return;
      }

      const apps = getApps();
      if (apps.length === 0) {
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
      } else {
        this.firebaseApp = apps[0];
      }

      this.messaging = getMessaging(this.firebaseApp);
      this.logger.log('Firebase initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase:', error);
    }
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto): Promise<PushNotificationResponseDto> {
    const existingToken = await this.prisma.deviceToken.findUnique({
      where: { token: dto.token },
    });

    if (existingToken) {
      const updatedToken = await this.prisma.deviceToken.update({
        where: { token: dto.token },
        data: {
          userId,
          deviceType: dto.deviceType,
          deviceName: dto.deviceName,
          isActive: true,
        },
      });
      return this.mapToResponse(updatedToken);
    }

    const deviceToken = await this.prisma.deviceToken.create({
      data: {
        userId,
        token: dto.token,
        deviceType: dto.deviceType,
        deviceName: dto.deviceName,
        isActive: true,
      },
    });

    return this.mapToResponse(deviceToken);
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });
  }

  async getUserDeviceTokens(userId: string): Promise<PushNotificationResponseDto[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    return tokens.map((t: any) => this.mapToResponse(t));
  }

  async sendPushNotification(dto: SendPushNotificationDto): Promise<void> {
    if (!this.messaging) {
      this.logger.warn('Firebase not initialized - skipping push notification');
      return;
    }

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        userId: dto.userId,
        isActive: true,
      },
    });

    if (deviceTokens.length === 0) {
      this.logger.warn(`No active device tokens found for user ${dto.userId}`);
      return;
    }

    const tokens = deviceTokens.map((t: any) => t.token);

    const message = {
      tokens,
      notification: {
        title: dto.title,
        body: dto.body,
      },
      data: dto.data ? JSON.parse(dto.data) : undefined,
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
        },
      },
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);
      
      this.logger.log(`Push notification sent to ${response.successCount} devices`);

      const invalidTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await this.prisma.deviceToken.updateMany({
          where: {
            token: { in: invalidTokens },
          },
          data: {
            isActive: false,
          },
        });
        this.logger.log(`Deactivated ${invalidTokens.length} invalid device tokens`);
      }
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
    }
  }

  async sendPushNotificationToUsers(userIds: string[], title: string, body: string, data?: any): Promise<void> {
    for (const userId of userIds) {
      await this.sendPushNotification({
        userId,
        title,
        body,
        data: data ? JSON.stringify(data) : undefined,
      });
    }
  }

  private mapToResponse(token: any): PushNotificationResponseDto {
    return {
      id: token.id,
      userId: token.userId,
      token: token.token,
      deviceType: token.deviceType,
      deviceName: token.deviceName,
      isActive: token.isActive,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
