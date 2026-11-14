import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationEmailWorkerService } from './notification-email-worker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('NotificationEmailWorkerService', () => {
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

  describe('getEmailContent', () => {
    it('should generate email content for NEW_VISIT_REQUEST', () => {
      const result = service['getEmailContent']('NEW_VISIT_REQUEST', 'Test User', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(result.subject).toContain('New Visit Request');
      expect(result.text).toContain('Test Property');
      expect(result.text).toContain('Test Tenant');
      expect(result.text).toContain('2024-01-15');
      expect(result.text).toContain('10:00');
    });

    it('should generate email content for NEW_APPLICATION', () => {
      const result = service['getEmailContent']('NEW_APPLICATION', 'Test User', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        applicationId: 'app-1',
      });

      expect(result.subject).toContain('New Rental Application');
      expect(result.text).toContain('Test Property');
      expect(result.text).toContain('Test Tenant');
    });

    it('should generate email content for APPLICATION_SELECTED', () => {
      const result = service['getEmailContent']('APPLICATION_SELECTED', 'Test User', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        applicationId: 'app-1',
      });

      expect(result.subject).toContain('Congratulations');
      expect(result.text).toContain('selected');
      expect(result.text).toContain('Test Property');
    });

    it('should generate email content for VISIT_ACCEPTED', () => {
      const result = service['getEmailContent']('VISIT_ACCEPTED', 'Test User', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(result.subject).toContain('Visit Request Accepted');
      expect(result.text).toContain('accepted');
      expect(result.text).toContain('2024-01-15');
    });

    it('should generate email content for VISIT_CANCELLED', () => {
      const result = service['getEmailContent']('VISIT_CANCELLED', 'Test User', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(result.subject).toContain('Visit Request Cancelled');
      expect(result.text).toContain('cancelled');
      expect(result.text).toContain('rented by another tenant');
    });

    it('should generate email content for DIGEST_SUMMARY', () => {
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
            type: 'application',
            propertyTitle: 'Property 2',
            tenantName: 'Tenant 2',
            applicationId: 'app-1',
          },
        ],
      });

      expect(result.subject).toContain('2 new notifications');
      expect(result.text).toContain('1 new visit request');
      expect(result.text).toContain('1 new application');
      expect(result.text).toContain('Property 1');
      expect(result.text).toContain('Property 2');
    });

    it('should generate default email content for unknown purpose', () => {
      const result = service['getEmailContent']('UNKNOWN_PURPOSE', 'Test User', {});

      expect(result.subject).toBe('Basha Vara Notification');
      expect(result.text).toBe('You have a new notification on Basha Vara.');
    });
  });

  describe('processEmail', () => {
    it('should process email for valid user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock sendEmail
      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: 'NEW_VISIT_REQUEST',
        data: {
          propertyTitle: 'Test Property',
          tenantName: 'Test Tenant',
          visitDate: '2024-01-15',
          visitTime: '10:00',
          visitId: 'visit-1',
        },
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, fullName: true },
      });
      expect(sendEmailSpy).toHaveBeenCalled();
    });

    it('should skip email for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: 'NEW_VISIT_REQUEST',
        data: {},
      });

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });
});
