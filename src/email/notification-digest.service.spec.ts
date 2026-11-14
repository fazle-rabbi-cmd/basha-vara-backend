import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotificationDigestService } from './notification-digest.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEmailQueueService } from './notification-email-queue.service.js';

describe('NotificationDigestService', () => {
  let service: NotificationDigestService;
  let prisma: any;
  let emailQueue: any;

  beforeEach(async () => {
    const mockPrisma = {};
    const mockEmailQueue = {
      queueNotificationEmail: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDigestService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: NotificationEmailQueueService,
          useValue: mockEmailQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationDigestService>(NotificationDigestService);
    prisma = module.get(PrismaService);
    emailQueue = module.get(NotificationEmailQueueService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queueForDigest', () => {
    it('should queue notification for digest', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      const pendingCount = service.getPendingCount('user-1');
      expect(pendingCount).toBe(1);
    });

    it('should queue multiple notifications for same user', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 1' });
      await service.queueForDigest('user-1', 'NEW_APPLICATION', { propertyTitle: 'Property 2' });
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 3' });

      const pendingCount = service.getPendingCount('user-1');
      expect(pendingCount).toBe(3);
    });

    it('should queue notifications for different users separately', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 1' });
      await service.queueForDigest('user-2', 'NEW_APPLICATION', { propertyTitle: 'Property 2' });

      expect(service.getPendingCount('user-1')).toBe(1);
      expect(service.getPendingCount('user-2')).toBe(1);
    });
  });

  describe('sendImmediateEmail', () => {
    it('should send immediate email', async () => {
      await service.sendImmediateEmail('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Test Property',
        tenantName: 'Test Tenant',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      expect(emailQueue.queueNotificationEmail).toHaveBeenCalledWith(
        'user-1',
        'NEW_VISIT_REQUEST',
        expect.objectContaining({
          propertyTitle: 'Test Property',
          tenantName: 'Test Tenant',
        })
      );
    });
  });

  describe('getPendingCount', () => {
    it('should return 0 for user with no pending notifications', () => {
      const count = service.getPendingCount('user-1');
      expect(count).toBe(0);
    });

    it('should return correct count for user with pending notifications', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 1' });
      await service.queueForDigest('user-1', 'NEW_APPLICATION', { propertyTitle: 'Property 2' });

      const count = service.getPendingCount('user-1');
      expect(count).toBe(2);
    });
  });

  describe('clearPendingNotifications', () => {
    it('should clear all pending notifications for user', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 1' });
      await service.queueForDigest('user-1', 'NEW_APPLICATION', { propertyTitle: 'Property 2' });

      service.clearPendingNotifications('user-1');

      const count = service.getPendingCount('user-1');
      expect(count).toBe(0);
    });

    it('should not affect other users', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', { propertyTitle: 'Property 1' });
      await service.queueForDigest('user-2', 'NEW_APPLICATION', { propertyTitle: 'Property 2' });

      service.clearPendingNotifications('user-1');

      expect(service.getPendingCount('user-1')).toBe(0);
      expect(service.getPendingCount('user-2')).toBe(1);
    });
  });

  describe('sendDigestEmails', () => {
    it('should send digest emails for old notifications', async () => {
      // Queue notifications with old timestamps
      const oldTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Property 1',
        tenantName: 'Tenant 1',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      // Manually set timestamp to be old
      const pending = service['pendingNotifications'].get('user-1');
      pending[0].timestamp = oldTime;

      // Trigger digest
      await service['sendDigestEmails']();

      expect(emailQueue.queueNotificationEmail).toHaveBeenCalledWith(
        'user-1',
        'DIGEST_SUMMARY',
        expect.objectContaining({
          count: 1,
          items: expect.arrayContaining([
            expect.objectContaining({
              type: 'visit',
              propertyTitle: 'Property 1',
            }),
          ]),
        })
      );
    });

    it('should not send digest emails for recent notifications', async () => {
      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Property 1',
        tenantName: 'Tenant 1',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      // Trigger digest
      await service['sendDigestEmails']();

      expect(emailQueue.queueNotificationEmail).not.toHaveBeenCalled();
    });

    it('should group notifications by type', async () => {
      const oldTime = Date.now() - (2 * 60 * 60 * 1000);

      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Property 1',
        tenantName: 'Tenant 1',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      await service.queueForDigest('user-1', 'NEW_APPLICATION', {
        propertyTitle: 'Property 2',
        tenantName: 'Tenant 2',
        applicationId: 'app-1',
      });

      // Manually set timestamps to be old
      const pending = service['pendingNotifications'].get('user-1');
      pending[0].timestamp = oldTime;
      pending[1].timestamp = oldTime;

      // Trigger digest
      await service['sendDigestEmails']();

      expect(emailQueue.queueNotificationEmail).toHaveBeenCalledWith(
        'user-1',
        'DIGEST_SUMMARY',
        expect.objectContaining({
          count: 2,
          items: expect.arrayContaining([
            expect.objectContaining({ type: 'visit' }),
            expect.objectContaining({ type: 'application' }),
          ]),
        })
      );
    });

    it('should handle mixed old and new notifications', async () => {
      const oldTime = Date.now() - (2 * 60 * 60 * 1000);
      const newTime = Date.now();

      await service.queueForDigest('user-1', 'NEW_VISIT_REQUEST', {
        propertyTitle: 'Property 1',
        tenantName: 'Tenant 1',
        visitDate: '2024-01-15',
        visitTime: '10:00',
        visitId: 'visit-1',
      });

      await service.queueForDigest('user-1', 'NEW_APPLICATION', {
        propertyTitle: 'Property 2',
        tenantName: 'Tenant 2',
        applicationId: 'app-1',
      });

      // Manually set timestamps
      const pending = service['pendingNotifications'].get('user-1');
      pending[0].timestamp = oldTime; // Old
      pending[1].timestamp = newTime; // New

      // Trigger digest
      await service['sendDigestEmails']();

      // Should only process the old notification
      expect(emailQueue.queueNotificationEmail).toHaveBeenCalledWith(
        'user-1',
        'DIGEST_SUMMARY',
        expect.objectContaining({
          count: 1,
          items: expect.arrayContaining([
            expect.objectContaining({ type: 'visit' }),
          ]),
        })
      );

      // New notification should remain
      expect(service.getPendingCount('user-1')).toBe(1);
    });

    it('should handle empty pending notifications', async () => {
      await service['sendDigestEmails']();

      expect(emailQueue.queueNotificationEmail).not.toHaveBeenCalled();
    });

    it('should handle notifications with no items', async () => {
      const oldTime = Date.now() - (2 * 60 * 60 * 1000);

      await service.queueForDigest('user-1', 'UNKNOWN_TYPE' as any, {});

      // Manually set timestamp to be old
      const pending = service['pendingNotifications'].get('user-1');
      pending[0].timestamp = oldTime;

      // Trigger digest
      await service['sendDigestEmails']();

      // Should not send email for unknown types
      expect(emailQueue.queueNotificationEmail).not.toHaveBeenCalled();
    });
  });
});
