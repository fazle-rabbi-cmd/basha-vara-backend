import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PushNotificationsService } from './push-notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

const mockInitializeApp = vi.fn().mockReturnValue({ name: 'test-app' });
const mockGetApps = vi.fn().mockReturnValue([]);
const mockGetMessaging = vi.fn().mockReturnValue({ sendEachForMulticast: vi.fn() });
const mockCert = vi.fn().mockReturnValue({ projectId: 'test' });

vi.mock('firebase-admin/app', () => ({
  initializeApp: (...args: any[]) => mockInitializeApp(...args),
  getApps: () => mockGetApps(),
  cert: (...args: any[]) => mockCert(...args),
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: (...args: any[]) => mockGetMessaging(...args),
}));

describe('PushNotificationsService - Firebase Init', () => {
  let service: PushNotificationsService;
  let configService: any;

  const buildService = async (config: Record<string, string | undefined>) => {
    const mockConfigService = {
      get: vi.fn((key: string) => config[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationsService,
        {
          provide: PrismaService,
          useValue: {
            deviceToken: {
              findUnique: vi.fn(),
              update: vi.fn(),
              create: vi.fn(),
              findMany: vi.fn(),
              updateMany: vi.fn(),
            },
          },
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PushNotificationsService>(PushNotificationsService);
    configService = module.get(ConfigService);
  };

  afterEach(() => {
    vi.clearAllMocks();
    mockGetApps.mockReturnValue([]);
  });

  it('should initialize Firebase when credentials provided and no apps exist', async () => {
    await buildService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_PRIVATE_KEY: 'line1\\nline2',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
    });

    service.onModuleInit();

    expect(mockCert).toHaveBeenCalledWith({
      projectId: 'test-project',
      privateKey: 'line1\nline2',
      clientEmail: 'test@example.com',
    });
    expect(mockInitializeApp).toHaveBeenCalled();
    expect(mockGetMessaging).toHaveBeenCalled();
    expect(service['messaging']).toBeDefined();
  });

  it('should reuse existing Firebase app when apps exist', async () => {
    mockGetApps.mockReturnValue([{ name: 'existing-app' }]);

    await buildService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_PRIVATE_KEY: 'key',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
    });

    service.onModuleInit();

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockGetMessaging).toHaveBeenCalledWith({ name: 'existing-app' });
    expect(service['messaging']).toBeDefined();
  });

  it('should skip init when credentials partially missing', async () => {
    await buildService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_PRIVATE_KEY: undefined,
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
    });

    service.onModuleInit();

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(service['messaging']).toBeUndefined();
  });

  it('should handle Firebase initialization errors gracefully', async () => {
    mockInitializeApp.mockImplementationOnce(() => {
      throw new Error('Firebase init failed');
    });

    await buildService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_PRIVATE_KEY: 'key',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
    });

    expect(() => service.onModuleInit()).not.toThrow();
    expect(service['messaging']).toBeUndefined();
  });
});
