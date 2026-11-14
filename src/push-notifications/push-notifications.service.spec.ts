import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PushNotificationsService } from './push-notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('PushNotificationsService', () => {
  let service: PushNotificationsService;
  let prisma: any;
  let configService: any;

  beforeEach(async () => {
    const mockPrisma = {
      deviceToken: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const mockConfigService = {
      get: vi.fn((key: string) => {
        const config = {
          FIREBASE_PROJECT_ID: 'test-project-id',
          FIREBASE_PRIVATE_KEY: 'test-private-key',
          FIREBASE_CLIENT_EMAIL: 'test@example.com',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PushNotificationsService>(PushNotificationsService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'Test Device',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.deviceToken.findUnique.mockResolvedValue(null);
      prisma.deviceToken.create.mockResolvedValue(mockToken);

      const result = await service.registerDeviceToken('user-1', {
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'Test Device',
      });

      expect(result).toEqual({
        id: mockToken.id,
        userId: mockToken.userId,
        token: mockToken.token,
        deviceType: mockToken.deviceType,
        deviceName: mockToken.deviceName,
        isActive: mockToken.isActive,
        createdAt: mockToken.createdAt,
        updatedAt: mockToken.updatedAt,
      });
      expect(prisma.deviceToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: 'device-token-123',
          deviceType: 'ANDROID',
          deviceName: 'Test Device',
          isActive: true,
        },
      });
    });

    it('should update existing device token', async () => {
      const existingToken = {
        id: 'token-1',
        userId: 'user-1',
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'Old Device',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedToken = {
        ...existingToken,
        userId: 'user-2',
        deviceName: 'New Device',
        isActive: true,
      };

      prisma.deviceToken.findUnique.mockResolvedValue(existingToken);
      prisma.deviceToken.update.mockResolvedValue(updatedToken);

      const result = await service.registerDeviceToken('user-2', {
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'New Device',
      });

      expect(result.userId).toBe('user-2');
      expect(result.deviceName).toBe('New Device');
      expect(result.isActive).toBe(true);
      expect(prisma.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'device-token-123' },
        data: {
          userId: 'user-2',
          deviceType: 'ANDROID',
          deviceName: 'New Device',
          isActive: true,
        },
      });
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister device token', async () => {
      const mockResult = { count: 1 };
      prisma.deviceToken.updateMany.mockResolvedValue(mockResult);

      await service.unregisterDeviceToken('user-1', 'device-token-123');

      expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          token: 'device-token-123',
        },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return user device tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'device-token-123',
          deviceType: 'ANDROID',
          deviceName: 'Test Device',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.deviceToken.findMany.mockResolvedValue(mockTokens);

      const result = await service.getUserDeviceTokens('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].token).toBe('device-token-123');
      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
        },
      });
    });
  });

  describe('sendPushNotification', () => {
    it('should send push notification to user devices', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'device-token-123',
          deviceType: 'ANDROID',
          deviceName: 'Test Device',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.deviceToken.findMany.mockResolvedValue(mockTokens);

      // Mock Firebase messaging
      service['messaging'] = {
        sendEachForMulticast: vi.fn().mockResolvedValue({
          successCount: 1,
          responses: [{ success: true }],
        }),
      };

      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
        data: JSON.stringify({ key: 'value' }),
      });

      expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
        },
      });
    });

    it('should handle no device tokens gracefully', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);

      // Mock Firebase messaging to be initialized
      service['messaging'] = {
        sendEachForMulticast: vi.fn().mockResolvedValue({
          successCount: 0,
          responses: [],
        }),
      };

      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
      });

      expect(prisma.deviceToken.findMany).toHaveBeenCalled();
    });

    it('should handle Firebase not initialized', async () => {
      service['messaging'] = undefined;

      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
      });

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('sendPushNotificationToUsers', () => {
    it('should send notifications to multiple users', async () => {
      const sendSpy = vi.spyOn(service, 'sendPushNotification').mockResolvedValue();

      await service.sendPushNotificationToUsers(
        ['user-1', 'user-2'],
        'Test Notification',
        'Test message',
        { key: 'value' }
      );

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
        data: JSON.stringify({ key: 'value' }),
      });
    });
  });
});
