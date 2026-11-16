import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PushNotificationsService } from './push-notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('PushNotificationsService - Edge Cases', () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerDeviceToken edge cases', () => {
    it('should update existing token when user changes device', async () => {
      const existingToken = {
        id: 'token-1',
        userId: 'old-user',
        token: 'device-token-123',
        deviceType: 'IOS',
        deviceName: 'Old Device',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedToken = {
        ...existingToken,
        userId: 'new-user',
        deviceType: 'ANDROID',
        deviceName: 'New Device',
      };

      prisma.deviceToken.findUnique.mockResolvedValue(existingToken);
      prisma.deviceToken.update.mockResolvedValue(updatedToken);

      const result = await service.registerDeviceToken('new-user', {
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'New Device',
      } as any);

      expect(result.userId).toBe('new-user');
      expect(result.deviceType).toBe('ANDROID');
      expect(prisma.deviceToken.update).toHaveBeenCalledWith({
        where: { token: 'device-token-123' },
        data: {
          userId: 'new-user',
          deviceType: 'ANDROID',
          deviceName: 'New Device',
          isActive: true,
        },
      });
    });

    it('should create new token for new device', async () => {
      const newToken = {
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
      prisma.deviceToken.create.mockResolvedValue(newToken);

      const result = await service.registerDeviceToken('user-1', {
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'Test Device',
      } as any);

      expect(result.userId).toBe('user-1');
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
  });

  describe('unregisterDeviceToken', () => {
    it('should deactivate specific token', async () => {
      prisma.deviceToken.updateMany.mockResolvedValue({ count: 1 });

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

    it('should handle non-existent token gracefully', async () => {
      prisma.deviceToken.updateMany.mockResolvedValue({ count: 0 });

      await service.unregisterDeviceToken('user-1', 'non-existent-token');

      expect(prisma.deviceToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return active tokens for user', async () => {
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
        {
          id: 'token-2',
          userId: 'user-1',
          token: 'device-token-456',
          deviceType: 'IOS',
          deviceName: 'iPhone',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.deviceToken.findMany.mockResolvedValue(mockTokens);

      const result = await service.getUserDeviceTokens('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].token).toBe('device-token-123');
      expect(result[1].token).toBe('device-token-456');
    });

    it('should return empty array when no tokens', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);

      const result = await service.getUserDeviceTokens('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('sendPushNotificationToUsers', () => {
    it('should send notifications to multiple users', async () => {
      const sendPushSpy = vi.spyOn(service, 'sendPushNotification').mockResolvedValue();

      await service.sendPushNotificationToUsers(
        ['user-1', 'user-2', 'user-3'],
        'Test Title',
        'Test Body',
        { key: 'value' }
      );

      expect(sendPushSpy).toHaveBeenCalledTimes(3);
      expect(sendPushSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        title: 'Test Title',
        body: 'Test Body',
        data: JSON.stringify({ key: 'value' }),
      });
    });

    it('should handle empty user list', async () => {
      const sendPushSpy = vi.spyOn(service, 'sendPushNotification').mockResolvedValue();

      await service.sendPushNotificationToUsers([], 'Test Title', 'Test Body');

      expect(sendPushSpy).not.toHaveBeenCalled();
    });
  });
});
