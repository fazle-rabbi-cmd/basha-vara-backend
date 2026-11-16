import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthEmailWorkerService } from './auth-email-worker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { AUTH_ACTION_TOKEN_PURPOSE, AUTH_EMAIL_PURPOSE } from './auth-email.types.js';

describe('AuthEmailWorkerService', () => {
  let service: AuthEmailWorkerService;
  let prisma: any;
  let configService: any;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      authActionToken: {
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback({
        authActionToken: {
          create: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      })),
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
        AuthEmailWorkerService,
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

    service = module.get<AuthEmailWorkerService>(AuthEmailWorkerService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmail', () => {
    it('should process PASSWORD_RESET email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hash',
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.$transaction.mockImplementation((callback) => callback({
        authActionToken: {
          deleteMany: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
      }));

      // Mock sendEmail
      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, fullName: true, passwordHash: true, status: true },
      });
      expect(sendEmailSpy).toHaveBeenCalled();
      expect(sendEmailSpy.mock.calls[0][1]).toContain('Reset your Basha Vara password');
    });

    it('should process PASSWORD_SETUP email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: null,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.$transaction.mockImplementation((callback) => callback({
        authActionToken: {
          deleteMany: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn(),
        },
      }));

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP,
      });

      expect(sendEmailSpy).toHaveBeenCalled();
      expect(sendEmailSpy.mock.calls[0][1]).toContain('Set your Basha Vara password');
    });

    it('should process GOOGLE_ACCOUNT_CREATED email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: null,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_EMAIL_PURPOSE.GOOGLE_ACCOUNT_CREATED,
      });

      expect(sendEmailSpy).toHaveBeenCalled();
      expect(sendEmailSpy.mock.calls[0][1]).toContain('account is ready');
    });

    it('should skip email for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
      });

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('should skip email for suspended user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hash',
        status: UserStatus.SUSPENDED,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_RESET,
      });

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('should skip PASSWORD_SETUP for user with existing password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'existing-hash',
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const sendEmailSpy = vi.spyOn(service as any, 'sendEmail').mockResolvedValue();

      await service['processEmail']({
        userId: 'user-1',
        purpose: AUTH_ACTION_TOKEN_PURPOSE.PASSWORD_SETUP,
      });

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should send email via Brevo', async () => {
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
        })
      );
    });

    it('should handle Brevo API errors', async () => {
      // Set brevoApiKey manually
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
  });
});
