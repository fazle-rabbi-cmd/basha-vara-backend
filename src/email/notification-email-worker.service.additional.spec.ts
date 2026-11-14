import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('NotificationEmailWorkerService - Additional Tests', () => {
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

  describe('sendEmail', () => {
    it('should send email via Brevo API', async () => {
      // Set brevoApiKey manually
      service['brevoApiKey'] = 'test-brevo-key';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      global.fetch = mockFetch;

      await service['sendEmail']('test@example.com', 'Test Subject', 'Test Body');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'api-key': 'test-brevo-key',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test@example.com'),
        })
      );
    });

    it('should handle Brevo API errors', async () => {
      service['brevoApiKey'] = 'test-brevo-key';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request'),
      });
      global.fetch = mockFetch;

      await expect(service['sendEmail']('test@example.com', 'Test Subject', 'Test Body'))
        .rejects.toThrow('Brevo request failed (400)');
    });

    it('should send email via SMTP when Brevo not configured', async () => {
      // Don't set brevoApiKey
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({}),
      };
      service['transporter'] = mockTransporter;

      await service['sendEmail']('test@example.com', 'Test Subject', 'Test Body');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });
    });

    it('should parse EMAIL_FROM with name and email', async () => {
      service['brevoApiKey'] = 'test-brevo-key';
      configService.getOrThrow.mockReturnValue('Basha Vara <noreply@bashavara.com>');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      global.fetch = mockFetch;

      await service['sendEmail']('test@example.com', 'Test Subject', 'Test Body');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Basha Vara'),
        })
      );
    });
  });

  describe('getEmailContent edge cases', () => {
    it('should handle DIGEST_SUMMARY with no items', () => {
      const result = service['getEmailContent']('DIGEST_SUMMARY', 'Test User', {
        count: 0,
        items: [],
      });

      expect(result.subject).toContain('0 new notification');
      expect(result.text).toContain('0 new notification');
    });

    it('should handle DIGEST_SUMMARY with only visits', () => {
      const result = service['getEmailContent']('DIGEST_SUMMARY', 'Test User', {
        count: 2,
        items: [
          {
            type: 'visit',
            propertyTitle: 'Property 1',
            tenantName: 'Tenant 1',
            visitDate: '2024-01-15',
            visitTime: '10:00',
            visitId: 'visit-1',
          },
          {
            type: 'visit',
            propertyTitle: 'Property 2',
            tenantName: 'Tenant 2',
            visitDate: '2024-01-16',
            visitTime: '11:00',
            visitId: 'visit-2',
          },
        ],
      });

      expect(result.subject).toContain('2 new notifications');
      expect(result.text).toContain('2 new visit requests');
      expect(result.text).toContain('Property 1');
      expect(result.text).toContain('Property 2');
    });

    it('should handle DIGEST_SUMMARY with only applications', () => {
      const result = service['getEmailContent']('DIGEST_SUMMARY', 'Test User', {
        count: 1,
        items: [
          {
            type: 'application',
            propertyTitle: 'Property 1',
            tenantName: 'Tenant 1',
            applicationId: 'app-1',
          },
        ],
      });

      expect(result.subject).toContain('1 new notification');
      expect(result.text).toContain('1 new application');
      expect(result.text).toContain('Property 1');
    });

    it('should handle DIGEST_SUMMARY with mixed items', () => {
      const result = service['getEmailContent']('DIGEST_SUMMARY', 'Test User', {
        count: 3,
        items: [
          {
            type: 'visit',
            propertyTitle: 'Property 1',
            tenantName: 'Tenant 1',
            visitDate: '2024-01-15',
            visitTime: '10:00',
            visitId: 'visit-1',
          },
          {
            type: 'application',
            propertyTitle: 'Property 2',
            tenantName: 'Tenant 2',
            applicationId: 'app-1',
          },
          {
            type: 'application',
            propertyTitle: 'Property 3',
            tenantName: 'Tenant 3',
            applicationId: 'app-2',
          },
        ],
      });

      expect(result.subject).toContain('3 new notifications');
      expect(result.text).toContain('1 new visit request');
      expect(result.text).toContain('2 new applications');
    });
  });
});
