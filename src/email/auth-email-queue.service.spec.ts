import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthEmailQueueService } from './auth-email-queue.service.js';
import { AUTH_EMAIL_QUEUE } from './auth-email.types.js';

describe('AuthEmailQueueService', () => {
  let service: AuthEmailQueueService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: vi.fn(),
      close: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthEmailQueueService,
        {
          provide: AUTH_EMAIL_QUEUE,
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AuthEmailQueueService>(AuthEmailQueueService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queueEmail', () => {
    it('should queue auth email', async () => {
      await service.queueEmail('user-1', 'PASSWORD_RESET' as any);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'PASSWORD_RESET',
        {
          userId: 'user-1',
          purpose: 'PASSWORD_RESET',
        },
        expect.objectContaining({
          jobId: expect.stringContaining('password_reset-user-1'),
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        })
      );
    });

    it('should queue different email types', async () => {
      await service.queueEmail('user-1', 'PASSWORD_SETUP' as any);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'PASSWORD_SETUP',
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

      expect(mockQueue.add).toHaveBeenCalledWith(
        'PASSWORD_RESET',
        expect.objectContaining({
          userId: 'user-1',
          purpose: 'PASSWORD_RESET',
        }),
        expect.any(Object)
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close queue on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
