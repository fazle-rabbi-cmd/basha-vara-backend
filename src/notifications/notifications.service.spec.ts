import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushNotificationsService } from '../push-notifications/push-notifications.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let pushNotificationsService: any;

  beforeEach(async () => {
    const mockPrisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    const mockPushNotifications = {
      sendPushNotification: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PushNotificationsService,
          useValue: mockPushNotifications,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService);
    pushNotificationsService = module.get(PushNotificationsService);
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      pushNotificationsService.sendPushNotification.mockResolvedValue(true);

      const result = await service.create('user-1', 'INFO', 'Test Notification', 'Test message');

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'INFO',
          title: 'Test Notification',
          message: 'Test message',
          data: {},
        },
      });
      expect(pushNotificationsService.sendPushNotification).toHaveBeenCalled();
    });

    it('should handle push notification failure gracefully', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      pushNotificationsService.sendPushNotification.mockRejectedValue(new Error('Push failed'));

      const result = await service.create('user-1', 'INFO', 'Test Notification', 'Test message');

      expect(result).toEqual(mockNotification);
      expect(pushNotificationsService.sendPushNotification).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: 'INFO',
          title: 'Test Notification',
          message: 'Test message',
          data: {},
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications('user-1');

      expect(result).toEqual(mockNotifications);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return unread notifications only', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: 'INFO',
          title: 'Test Notification',
          message: 'Test message',
          data: {},
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications('user-1', true);

      expect(result).toEqual(mockNotifications);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isRead: false,
        },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      const updatedNotification = { ...mockNotification, isRead: true };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead('notification-1', 'user-1');

      expect(result).toEqual(updatedNotification);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { isRead: true },
      });
    });

    it('should throw error for non-existent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('notification-1', 'user-1'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw error for unauthorized access', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'other-user',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.markAsRead('notification-1', 'user-1'))
        .rejects.toThrow('Access denied');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const mockResult = { count: 5 };
      prisma.notification.updateMany.mockResolvedValue(mockResult);

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual(mockResult);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.deleteNotification('notification-1', 'user-1');

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
      });
    });

    it('should throw error for non-existent notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.deleteNotification('notification-1', 'user-1'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw error for unauthorized access', async () => {
      const mockNotification = {
        id: 'notification-1',
        userId: 'other-user',
        type: 'INFO',
        title: 'Test Notification',
        message: 'Test message',
        data: {},
        isRead: false,
        createdAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.deleteNotification('notification-1', 'user-1'))
        .rejects.toThrow('Access denied');
    });
  });
});
