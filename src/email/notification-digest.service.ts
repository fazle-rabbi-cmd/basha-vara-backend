import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NotificationEmailPurpose } from './notification-email.types.js';

interface PendingNotification {
  userId: string;
  purpose: NotificationEmailPurpose;
  data: any;
  timestamp: number;
}

@Injectable()
export class NotificationDigestService {
  private readonly logger = new Logger(NotificationDigestService.name);
  private pendingNotifications: Map<string, PendingNotification[]> = new Map();
  private digestInterval: NodeJS.Timeout | null = null;
  private readonly DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: NotificationEmailQueueService,
  ) {}

  onModuleInit() {
    // Start digest timer
    this.digestInterval = setInterval(() => {
      this.sendDigestEmails();
    }, this.DIGEST_INTERVAL_MS);

    this.logger.log('Notification digest service started');
  }

  onModuleDestroy() {
    if (this.digestInterval) {
      clearInterval(this.digestInterval);
    }
  }

  /**
   * Add notification to digest queue instead of sending immediately
   * For high-priority notifications, use sendImmediateEmail instead
   */
  async queueForDigest(userId: string, purpose: NotificationEmailPurpose, data: any) {
    if (!this.pendingNotifications.has(userId)) {
      this.pendingNotifications.set(userId, []);
    }

    const notifications = this.pendingNotifications.get(userId)!;
    notifications.push({
      userId,
      purpose,
      data,
      timestamp: Date.now(),
    });

    this.logger.log(`Added ${purpose} to digest queue for user ${userId}`);
  }

  /**
   * Send immediate email for critical notifications
   */
  async sendImmediateEmail(userId: string, purpose: NotificationEmailPurpose, data: any) {
    await this.emailQueue.queueNotificationEmail(userId, purpose, data);
    this.logger.log(`Sent immediate email ${purpose} to user ${userId}`);
  }

  /**
   * Send digest emails for all pending notifications
   */
  private async sendDigestEmails() {
    const now = Date.now();
    const oneHourAgo = now - this.DIGEST_INTERVAL_MS;

    for (const [userId, notifications] of this.pendingNotifications.entries()) {
      // Filter notifications older than 1 hour
      const oldNotifications = notifications.filter(n => n.timestamp < oneHourAgo);
      
      if (oldNotifications.length === 0) continue;

      // Group by type
      const visitRequests = oldNotifications.filter(n => n.purpose === 'NEW_VISIT_REQUEST');
      const applications = oldNotifications.filter(n => n.purpose === 'NEW_APPLICATION');

      // Create digest items
      const items: any[] = [];

      visitRequests.forEach(n => {
        items.push({
          type: 'visit',
          propertyTitle: n.data.propertyTitle,
          tenantName: n.data.tenantName,
          visitDate: n.data.visitDate,
          visitTime: n.data.visitTime,
          visitId: n.data.visitId,
        });
      });

      applications.forEach(n => {
        items.push({
          type: 'application',
          propertyTitle: n.data.propertyTitle,
          tenantName: n.data.tenantName,
          applicationId: n.data.applicationId,
        });
      });

      if (items.length > 0) {
        // Send digest email
        await this.emailQueue.queueNotificationEmail(userId, 'DIGEST_SUMMARY', {
          count: items.length,
          items,
        });

        this.logger.log(`Sent digest email to user ${userId} with ${items.length} notifications`);
      }

      // Remove processed notifications
      const remainingNotifications = notifications.filter(n => n.timestamp >= oneHourAgo);
      if (remainingNotifications.length === 0) {
        this.pendingNotifications.delete(userId);
      } else {
        this.pendingNotifications.set(userId, remainingNotifications);
      }
    }
  }

  /**
   * Get pending notification count for a user
   */
  getPendingCount(userId: string): number {
    return this.pendingNotifications.get(userId)?.length || 0;
  }

  /**
   * Clear all pending notifications for a user
   */
  clearPendingNotifications(userId: string) {
    this.pendingNotifications.delete(userId);
  }
}
