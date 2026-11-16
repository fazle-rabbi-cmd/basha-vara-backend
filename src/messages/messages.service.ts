import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto, MessageResponseDto } from './dto/message.dto.js';
import { MessageType } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: string, dto: SendMessageDto): Promise<MessageResponseDto> {
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        propertyId: dto.propertyId || null,
        content: dto.content || '',
        messageType: dto.messageType || MessageType.TEXT,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return this.mapToResponse(message);
  }

  async getMessages(userId: string, otherUserId?: string, propertyId?: string): Promise<MessageResponseDto[]> {
    const where: any = {
      OR: [
        { senderId: userId },
        { receiverId: userId },
      ],
    };

    if (otherUserId) {
      where.OR = [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ];
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages.map((m) => this.mapToResponse(m));
  }

  async getConversations(userId: string): Promise<any[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const conversationMap = new Map<string, any>();

    for (const message of messages) {
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      const otherUser = message.senderId === userId ? message.receiver : message.sender;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          user: {
            id: otherUser.id,
            fullName: otherUser.fullName,
            email: otherUser.email,
          },
          property: message.property,
          lastMessage: this.mapToResponse(message),
          unreadCount: 0,
        });
      } else {
        const conversation = conversationMap.get(otherUserId);
        if (message.receiverId === userId && !message.isRead) {
          conversation.unreadCount += 1;
        }
      }
    }

    return Array.from(conversationMap.values());
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new NotFoundException('You can only mark your own messages as read');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  private mapToResponse(message: any): MessageResponseDto {
    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      propertyId: message.propertyId,
      content: message.content,
      messageType: message.messageType,
      isRead: message.isRead,
      createdAt: message.createdAt,
      sender: message.sender ? {
        id: message.sender.id,
        fullName: message.sender.fullName,
        email: message.sender.email,
      } : undefined,
      receiver: message.receiver ? {
        id: message.receiver.id,
        fullName: message.receiver.fullName,
        email: message.receiver.email,
      } : undefined,
      property: message.property ? {
        id: message.property.id,
        title: message.property.title,
      } : undefined,
    };
  }
}
