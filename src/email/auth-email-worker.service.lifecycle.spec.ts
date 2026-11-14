import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthEmailWorkerService } from './auth-email-worker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('AuthEmailWorkerService - Lifecycle', () => {
  let service: AuthEmailWorkerService;
  let prisma: any;
  let configService: any;
  let configValues: Record<string, string | undefined>;

  const buildService = async () => {
    const mockPrisma = {
      user: { findUnique: vi.fn() },
      authActionToken: {
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn((key: string) => configValues[key]),
      getOrThrow: vi.fn((key: string) => {
        const value = configValues[key];
        if (value === undefined) throw new Error(`Missing config: ${key}`);
        return value;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthEmailWorkerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthEmailWorkerService>(AuthEmailWorkerService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize with Brevo API key', async () => {
      configValues = {
        EMAIL_FROM: 'test@example.com',
        BREVO_API_KEY: 'test-brevo-key',
        REDIS_URL: 'redis://localhost:6379',
      };
      await buildService();

      service.onModuleInit();

      expect(service['brevoApiKey']).toBe('test-brevo-key');
      expect(service['transporter']).toBeUndefined();
      expect(service['connection']).toBeDefined();
      expect(service['worker']).toBeDefined();
    });

    it('should initialize with SMTP when Brevo not configured', async () => {
      configValues = {
        EMAIL_FROM: 'test@example.com',
        SMTP_HOST: 'smtp.test.com',
        SMTP_USER: 'test@example.com',
        SMTP_PASS: 'test-password',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        REDIS_URL: 'redis://localhost:6379',
      };
      await buildService();

      service.onModuleInit();

      expect(service['brevoApiKey']).toBeUndefined();
      expect(service['transporter']).toBeDefined();
      expect(service['connection']).toBeDefined();
      expect(service['worker']).toBeDefined();
    });

    it('should throw when EMAIL_FROM missing', async () => {
      configValues = {
        BREVO_API_KEY: 'test-brevo-key',
        REDIS_URL: 'redis://localhost:6379',
      };
      await buildService();

      expect(() => service.onModuleInit()).toThrow(/Configure EMAIL_FROM/);
    });

    it('should throw when neither Brevo nor SMTP configured', async () => {
      configValues = {
        EMAIL_FROM: 'test@example.com',
        REDIS_URL: 'redis://localhost:6379',
      };
      await buildService();

      expect(() => service.onModuleInit()).toThrow(/Configure EMAIL_FROM/);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up resources', async () => {
      configValues = {
        EMAIL_FROM: 'test@example.com',
        BREVO_API_KEY: 'test-brevo-key',
        REDIS_URL: 'redis://localhost:6379',
      };
      await buildService();
      service.onModuleInit();

      service['worker'] = { close: vi.fn().mockResolvedValue(undefined) } as any;
      service['connection'] = { quit: vi.fn().mockResolvedValue(undefined) } as any;
      service['transporter'] = { close: vi.fn() } as any;

      await service.onModuleDestroy();

      expect(service['worker']?.close).toHaveBeenCalled();
      expect(service['connection']?.quit).toHaveBeenCalled();
      expect(service['transporter']?.close).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', async () => {
      configValues = {};
      await buildService();

      await service.onModuleDestroy();

      expect(true).toBe(true);
    });
  });

  describe('sendEmail edge cases', () => {
    it('should send email via SMTP transporter', async () => {
      configValues = {
        EMAIL_FROM: 'test@example.com',
        FRONTEND_URL: 'http://localhost:3000',
      };
      await buildService();

      const mockTransporter = { sendMail: vi.fn().mockResolvedValue({}) };
      service['transporter'] = mockTransporter as any;
      service['brevoApiKey'] = undefined;

      await service['sendEmail']('test@example.com', 'Subject', 'Body');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Subject',
        text: 'Body',
      });
    });

    it('should parse EMAIL_FROM with display name', async () => {
      configValues = {
        EMAIL_FROM: 'Basha Vara <noreply@bashavara.com>',
        FRONTEND_URL: 'http://localhost:3000',
      };
      await buildService();

      service['brevoApiKey'] = 'key';
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await service['sendEmail']('test@example.com', 'Subject', 'Body');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          body: expect.stringContaining('Basha Vara'),
        }),
      );
    });
  });
});
