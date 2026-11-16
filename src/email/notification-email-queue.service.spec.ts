import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { NOTIFICATION_EMAIL_QUEUE } from './notification-email.types.js';

describe('NotificationEmailQueueService', () => {
  let service: NotificationEmailQueueService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: vi.fn(),
      close: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEmailQueueService,
        {
          provide: NOTIFICATION_EMAIL_QUEUE,
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationEmailQueueService>(NotificationEmailQueueService);
  });

  describe('queueNotificationEmail', () => {
    it('should queue notification email', async () => {
      await service.queueNotificationEmail('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'NEW_VISIT_REQUEST',
        {
          userId: 'user-1',
          purpose: 'NEW_VISIT_REQUEST',
          data: expect.objectContaining({
            propertyTitle: 'Test Property',
            tenantName: 'Test Tenant',
          }),
        },
        expect.objectContaining({
          jobId: expect.stringContaining('new_visit_request-user-1'),
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        })
      );
    });

    it('should queue different email types', async () => {
      await service.queueNotificationEmail('user-1', 'NEW_APPLICATION', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        applicationId: 'app-1',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'NEW_APPLICATION',
        expect.objectContaining({
          userId: 'user-1',
          purpose: 'NEW_APPLICATION',
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
