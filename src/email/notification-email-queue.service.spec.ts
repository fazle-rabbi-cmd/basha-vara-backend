import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';
import { PgBossService } from '../pg-boss/pg-boss.service.js';
import { NOTIFICATION_EMAIL_QUEUE } from './notification-email.types.js';

describe('NotificationEmailQueueService', () => {
  let service: NotificationEmailQueueService;
  let mockPgBoss: any;

  beforeEach(async () => {
    mockPgBoss = {
      send: vi.fn().mockResolvedValue('job-id-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEmailQueueService,
        {
          provide: PgBossService,
          useValue: mockPgBoss,
        },
      ],
    }).compile();

    service = module.get<NotificationEmailQueueService>(NotificationEmailQueueService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queueNotificationEmail', () => {
    it('should queue notification email via pg-boss', async () => {
      await service.queueNotificationEmail('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(mockPgBoss.send).toHaveBeenCalledWith(
        NOTIFICATION_EMAIL_QUEUE,
        {
          userId: 'user-1',
          purpose: 'NEW_VISIT_REQUEST',
          data: expect.objectContaining({
            propertyTitle: 'Test Property',
            tenantName: 'Test Tenant',
          }),
        },
        expect.objectContaining({
          retryLimit: 3,
          retryBackoff: true,
        })
      );
    });

    it('should queue different email types', async () => {
      await service.queueNotificationEmail('user-1', 'NEW_APPLICATION', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        applicationId: 'app-1',
      });

      expect(mockPgBoss.send).toHaveBeenCalledWith(
        NOTIFICATION_EMAIL_QUEUE,
        expect.objectContaining({
          userId: 'user-1',
          purpose: 'NEW_APPLICATION',
        }),
        expect.any(Object)
      );
    });
  });
});
