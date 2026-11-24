import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthEmailQueueService } from './auth-email-queue.service.js';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { AUTH_EMAIL_QUEUE } from './auth-email.types.js';

describe('AuthEmailQueueService', () => {
  let service: AuthEmailQueueService;
  let mockPgBoss: any;

  beforeEach(async () => {
    mockPgBoss = {
      send: vi.fn().mockResolvedValue('job-id-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthEmailQueueService,
        {
          provide: PgBossService,
          useValue: mockPgBoss,
        },
      ],
    }).compile();

    service = module.get<AuthEmailQueueService>(AuthEmailQueueService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queueEmail', () => {
    it('should queue auth email via pg-boss', async () => {
      await service.queueEmail('user-1', 'PASSWORD_RESET' as any);

      expect(mockPgBoss.send).toHaveBeenCalledWith(
        AUTH_EMAIL_QUEUE,
        {
          userId: 'user-1',
          purpose: 'PASSWORD_RESET',
        },
        expect.objectContaining({
          retryLimit: 5,
          retryBackoff: true,
          singletonKey: 'PASSWORD_RESET-user-1',
          singletonSeconds: 60,
        })
      );
    });

    it('should queue different email types', async () => {
      await service.queueEmail('user-1', 'PASSWORD_SETUP' as any);

      expect(mockPgBoss.send).toHaveBeenCalledWith(
        AUTH_EMAIL_QUEUE,
        expect.objectContaining({
          userId: 'user-1',
          purpose: 'PASSWORD_SETUP',
        }),
        expect.any(Object)
      );
    });
  });

  describe('queuePasswordLink', () => {
    it('should queue password link email', async () => {
      await service.queuePasswordLink('user-1', 'PASSWORD_RESET' as any);

      expect(mockPgBoss.send).toHaveBeenCalledWith(
        AUTH_EMAIL_QUEUE,
        expect.objectContaining({
          userId: 'user-1',
          purpose: 'PASSWORD_RESET',
        }),
        expect.any(Object)
      );
    });
  });
});
