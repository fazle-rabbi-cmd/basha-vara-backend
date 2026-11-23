import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
}

export interface NotificationMatrixEntry {
  event: NotificationType;
  recipient: 'TENANT' | 'LANDLORD' | 'ADMIN' | 'BOTH';
  channels: NotificationChannel[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class NotificationMatrixService {
  private readonly logger = new Logger(NotificationMatrixService.name);

  // Notification matrix: event x recipient x channel
  private readonly notificationMatrix: NotificationMatrixEntry[] = [
    // Visit notifications
    { event: NotificationType.VISIT_REQUESTED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.VISIT_ACCEPTED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.VISIT_DECLINED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.VISIT_CANCELLED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },
    { event: NotificationType.VISIT_COMPLETED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'LOW' },

    // Application notifications
    { event: NotificationType.APPLICATION_SUBMITTED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.APPLICATION_UNDER_REVIEW, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },
    { event: NotificationType.APPLICATION_SHORTLISTED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.APPLICATION_REJECTED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },
    { event: NotificationType.APPLICATION_SELECTED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.APPLICATION_WITHDRAWN, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },

    // Property notifications
    { event: NotificationType.PROPERTY_PUBLISHED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'LOW' },
    { event: NotificationType.PROPERTY_RENTED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.PROPERTY_PAUSED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },

    // Contact notifications
    { event: NotificationType.CONTACT_REVEALED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },

    // Escrow notifications
    { event: NotificationType.ESCROW_RELEASED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.ESCROW_REFUNDED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.ESCROW_DISPUTED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.ESCROW_RESOLVED, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },

    // Trust & Safety notifications
    { event: NotificationType.LISTING_VERIFICATION_DUPLICATE, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'HIGH' },
    { event: NotificationType.LISTING_VERIFICATION_REVIEWED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.REPORT_RESOLVED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },
    { event: NotificationType.NEW_REPORT, recipient: 'ADMIN', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'HIGH' },
    { event: NotificationType.RENT_PAYMENT_RECORDED, recipient: 'TENANT', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.RENT_PAYMENT_ACKNOWLEDGED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },
    { event: NotificationType.RENT_PAYMENT_DISPUTED, recipient: 'LANDLORD', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], priority: 'HIGH' },
    { event: NotificationType.NEW_REVIEW, recipient: 'BOTH', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'MEDIUM' },

    // System notifications
    { event: NotificationType.SYSTEM, recipient: 'ADMIN', channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH], priority: 'HIGH' },
  ];

  constructor(private prisma: PrismaService) {}

  async shouldSendNotification(
    userId: string,
    event: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    // Check user preferences
    const preference = await this.prisma.notificationPreference.findFirst({
      where: {
        userId,
        notificationType: event,
        channel,
      },
    });

    // If preference exists, use it; otherwise default to enabled
    return preference ? preference.enabled : true;
  }

  async getNotificationChannels(
    userId: string,
    event: NotificationType,
  ): Promise<NotificationChannel[]> {
    const matrixEntry = this.notificationMatrix.find((entry) => entry.event === event);

    if (!matrixEntry) {
      this.logger.warn(`No matrix entry found for event: ${event}`);
      return [NotificationChannel.IN_APP];
    }

    const channels: NotificationChannel[] = [];

    for (const channel of matrixEntry.channels) {
      const shouldSend = await this.shouldSendNotification(userId, event, channel);
      if (shouldSend) {
        channels.push(channel);
      }
    }

    return channels;
  }

  async getUserPreferences(userId: string): Promise<any[]> {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ notificationType: 'asc' }, { channel: 'asc' }],
    });
  }

  async updateUserPreference(
    userId: string,
    notificationType: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<any> {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_notificationType_channel: {
          userId,
          notificationType,
          channel,
        },
      },
      update: { enabled },
      create: {
        userId,
        notificationType,
        channel,
        enabled,
      },
    });
  }

  async getMatrixForEvent(event: NotificationType): Promise<NotificationMatrixEntry | null> {
    return this.notificationMatrix.find((entry) => entry.event === event) || null;
  }

  async getAllMatrixEntries(): Promise<NotificationMatrixEntry[]> {
    return this.notificationMatrix;
  }
}
