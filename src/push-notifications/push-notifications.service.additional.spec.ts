import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PushNotificationsService } from './push-notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('PushNotificationsService - Additional Tests', () => {
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

  describe('onModuleInit', () => {
    it('should handle Firebase initialization gracefully', async () => {
      // This test verifies the method doesn't throw when Firebase credentials are missing
      configService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      // Should not throw error
      expect(true).toBe(true);
    });

    it('should not initialize Firebase when credentials are missing', async () => {
      configService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      expect(service['messaging']).toBeUndefined();
    });
  });

  describe('sendPushNotification - Error Handling', () => {
    it('should handle Firebase messaging errors gracefully', async () => {
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

      // Mock Firebase messaging to throw error
      service['messaging'] = {
        sendEachForMulticast: vi.fn().mockRejectedValue(new Error('Firebase error')),
      };

      // Should not throw error
      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
      });

      expect(prisma.deviceToken.findMany).toHaveBeenCalled();
    });

    it('should deactivate invalid tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'invalid-token',
          deviceType: 'ANDROID',
          deviceName: 'Test Device',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.deviceToken.findMany.mockResolvedValue(mockTokens);
      prisma.deviceToken.updateMany.mockResolvedValue({ count: 1 });

      // Mock Firebase messaging to return invalid token error
      service['messaging'] = {
        sendEachForMulticast: vi.fn().mockResolvedValue({
          successCount: 0,
          responses: [
            {
              success: false,
              error: {
                code: 'messaging/invalid-registration-token',
              },
            },
          ],
        }),
      };

      await service.sendPushNotification({
        userId: 'user-1',
        title: 'Test Notification',
        body: 'Test message',
      });

      expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
        where: {
          token: { in: ['invalid-token'] },
        },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('mapToResponse', () => {
    it('should map token to response format', () => {
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

      const result = service['mapToResponse'](mockToken);

      expect(result).toEqual({
        id: 'token-1',
        userId: 'user-1',
        token: 'device-token-123',
        deviceType: 'ANDROID',
        deviceName: 'Test Device',
        isActive: true,
        createdAt: mockToken.createdAt,
        updatedAt: mockToken.updatedAt,
      });
    });
  });
});
