import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('NotificationEmailWorkerService - Lifecycle Tests', () => {
  let service: NotificationEmailWorkerService;
  let prisma: any;
  let configService: any;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    };

    const mockConfigService = {
      get: vi.fn((key: string) => {
        const config = {
          EMAIL_FROM: 'test@example.com',
          BREVO_API_KEY: 'test-brevo-key',
          SMTP_HOST: 'smtp.test.com',
          SMTP_USER: 'test@example.com',
          SMTP_PASS: 'test-password',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          REDIS_URL: 'redis://localhost:6379',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
      getOrThrow: vi.fn((key: string) => {
        const config = {
          EMAIL_FROM: 'test@example.com',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEmailWorkerService,
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

    service = module.get<NotificationEmailWorkerService>(NotificationEmailWorkerService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize with Brevo API key', () => {
      service.onModuleInit();

      expect(service['brevoApiKey']).toBe('test-brevo-key');
      expect(service['transporter']).toBeUndefined();
      expect(service['connection']).toBeDefined();
      expect(service['worker']).toBeDefined();
    });

    it('should initialize with SMTP when Brevo not configured', () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          EMAIL_FROM: 'test@example.com',
          BREVO_API_KEY: undefined,
          SMTP_HOST: 'smtp.test.com',
          SMTP_USER: 'test@example.com',
          SMTP_PASS: 'test-password',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          REDIS_URL: 'redis://localhost:6379',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      });

      service.onModuleInit();

      expect(service['brevoApiKey']).toBeUndefined();
      expect(service['transporter']).toBeDefined();
      expect(service['connection']).toBeDefined();
      expect(service['worker']).toBeDefined();
    });

    it('should skip initialization when email not configured', () => {
      configService.get.mockImplementation((key: string) => {
        const config = {
          EMAIL_FROM: undefined,
          BREVO_API_KEY: undefined,
          SMTP_HOST: undefined,
          SMTP_USER: undefined,
          SMTP_PASS: undefined,
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          REDIS_URL: 'redis://localhost:6379',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      });

      service.onModuleInit();

      expect(service['brevoApiKey']).toBeUndefined();
      expect(service['transporter']).toBeUndefined();
      expect(service['connection']).toBeUndefined();
      expect(service['worker']).toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up resources', async () => {
      // Initialize first
      service.onModuleInit();

      // Mock close methods
      service['worker'] = {
        close: vi.fn().mockResolvedValue(undefined),
      } as any;
      service['connection'] = {
        quit: vi.fn().mockResolvedValue(undefined),
      } as any;
      service['transporter'] = {
        close: vi.fn(),
      } as any;

      await service.onModuleDestroy();

      expect(service['worker']?.close).toHaveBeenCalled();
      expect(service['connection']?.quit).toHaveBeenCalled();
      expect(service['transporter']?.close).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', async () => {
      // Don't initialize
      await service.onModuleDestroy();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
