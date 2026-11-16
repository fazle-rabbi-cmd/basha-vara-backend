import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
import { PushNotificationsService } from '../push-notifications/push-notifications.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private pushNotificationsService: PushNotificationsService,
  ) {}

  async create(userId: string, type: NotificationType, title: string, message: string, data?: any) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || {},
      },
    });

    // Send push notification
    try {
      await this.pushNotificationsService.sendPushNotification({
        userId,
        title,
        body: message,
        data: data ? JSON.stringify(data) : undefined,
      });
    } catch (error) {
      // Log error but don't fail the notification creation
      console.error('Failed to send push notification:', error);
    }

    return notification;
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Access denied');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Access denied');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }
}
