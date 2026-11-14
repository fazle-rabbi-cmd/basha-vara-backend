import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { MessagesService } from './messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: any;

  const mockMessage = {
    id: 'msg-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    propertyId: 'prop-1',
    content: 'Hello',
    messageType: MessageType.TEXT,
    isRead: false,
    createdAt: new Date('2025-01-01'),
    sender: { id: 'user-1', fullName: 'Sender', email: 's@e.com' },
    receiver: { id: 'user-2', fullName: 'Receiver', email: 'r@e.com' },
    property: { id: 'prop-1', title: 'Test Property' },
  };

  beforeEach(async () => {
    const mockPrisma = {
      message: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('sendMessage', () => {
    it('creates a text message with defaults', async () => {
      prisma.message.create.mockResolvedValue(mockMessage);

      const result = await service.sendMessage('user-1', {
        receiverId: 'user-2',
      } as any);

      expect(result.id).toBe('msg-1');
      expect(result.sender?.fullName).toBe('Sender');
      expect(result.receiver?.fullName).toBe('Receiver');
      expect(result.property?.title).toBe('Test Property');
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderId: 'user-1',
          receiverId: 'user-2',
          propertyId: null,
          content: '',
          messageType: MessageType.TEXT,
        }),
        include: expect.any(Object),
      });
    });

    it('creates message with all fields', async () => {
      prisma.message.create.mockResolvedValue({
        ...mockMessage,
        messageType: MessageType.IMAGE,
      });

      const result = await service.sendMessage('user-1', {
        receiverId: 'user-2',
        propertyId: 'prop-1',
        content: 'Check this',
        messageType: MessageType.IMAGE,
      } as any);

      expect(result.messageType).toBe(MessageType.IMAGE);
    });
  });

  describe('getMessages', () => {
    it('returns all messages for user', async () => {
      prisma.message.findMany.mockResolvedValue([mockMessage]);
      const result = await service.getMessages('user-1');
      expect(result).toHaveLength(1);
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: 'user-1' },
            { receiverId: 'user-1' },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('filters by other user', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      await service.getMessages('user-1', 'user-2');
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: 'user-1', receiverId: 'user-2' },
            { senderId: 'user-2', receiverId: 'user-1' },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('filters by property', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      await service.getMessages('user-1', undefined, 'prop-1');
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: 'user-1' },
            { receiverId: 'user-1' },
          ],
          propertyId: 'prop-1',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getConversations', () => {
    it('groups messages into conversations', async () => {
      prisma.message.findMany.mockResolvedValue([
        mockMessage,
        { ...mockMessage, id: 'msg-2', isRead: true, createdAt: new Date('2025-01-02') },
        {
          ...mockMessage,
          id: 'msg-3',
          senderId: 'user-3',
          receiverId: 'user-1',
          sender: { id: 'user-3', fullName: 'Other', email: 'o@e.com' },
          receiver: mockMessage.sender,
          isRead: false,
        },
      ]);

      const result = await service.getConversations('user-1');

      expect(result).toHaveLength(2);
      const conv1 = result.find((c) => c.userId === 'user-2');
      const conv2 = result.find((c) => c.userId === 'user-3');
      expect(conv1.user.fullName).toBe('Receiver');
      expect(conv2.user.fullName).toBe('Other');
      expect(conv2.unreadCount).toBe(0);
    });

    it('counts unread messages from other users', async () => {
      prisma.message.findMany.mockResolvedValue([
        {
          ...mockMessage,
          id: 'msg-1',
          senderId: 'user-2',
          receiverId: 'user-1',
          sender: mockMessage.receiver,
          receiver: mockMessage.sender,
          isRead: false,
        },
        {
          ...mockMessage,
          id: 'msg-2',
          senderId: 'user-2',
          receiverId: 'user-1',
          sender: mockMessage.receiver,
          receiver: mockMessage.sender,
          isRead: false,
          createdAt: new Date('2025-01-03'),
        },
      ]);

      const result = await service.getConversations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].unreadCount).toBe(1);
    });

    it('returns empty array for no messages', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      const result = await service.getConversations('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('marks message as read for receiver', async () => {
      prisma.message.findUnique.mockResolvedValue({ ...mockMessage, receiverId: 'user-1' });
      prisma.message.update.mockResolvedValue({});

      await service.markAsRead('msg-1', 'user-1');

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isRead: true },
      });
    });

    it('throws NotFoundException for missing message', async () => {
      prisma.message.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('bad', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user is not receiver', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage);
      await expect(service.markAsRead('msg-1', 'user-3')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markConversationAsRead', () => {
    it('marks all messages from other user as read', async () => {
      prisma.message.updateMany.mockResolvedValue({ count: 5 });

      await service.markConversationAsRead('user-1', 'user-2');

      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          senderId: 'user-2',
          receiverId: 'user-1',
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });
});
