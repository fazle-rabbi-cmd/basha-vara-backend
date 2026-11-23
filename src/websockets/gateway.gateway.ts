import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service.js';
import { MessageType } from '@prisma/client';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        throw new Error('No token provided');
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      client.join(`user-${payload.sub}`);
    } catch (error) {
      console.error('WebSocket: Authentication error:', error);
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    // Client disconnected - no logging needed for normal disconnects
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; propertyId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    // Users may only join their own user room or property rooms
    if (data.userId !== userId && !data.propertyId) {
      return;
    }

    const room = data.propertyId ? `property-${data.propertyId}` : `user-${userId}`;
    client.join(room);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; propertyId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    if (data.userId !== userId && !data.propertyId) {
      return;
    }

    const room = data.propertyId ? `property-${data.propertyId}` : `user-${userId}`;
    client.leave(room);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      senderId: string;
      receiverId: string;
      propertyId?: string;
      content: string;
      messageType: string;
    },
  ) {
    const senderId = client.data.userId;
    if (!senderId || senderId !== data.senderId) {
      return;
    }

    try {
      // Save message to database
      const message = await this.messagesService.sendMessage(senderId, {
        receiverId: data.receiverId,
        content: data.content,
        messageType: data.messageType as MessageType,
        propertyId: data.propertyId,
      });

      // Broadcast to receiver
      const receiverRoom = `user-${data.receiverId}`;
      this.server.to(receiverRoom).emit('new-message', message);

      // Also send to sender's room for consistency
      const senderRoom = `user-${senderId}`;
      this.server.to(senderRoom).emit('new-message', message);
    } catch (error) {
      console.error('WebSocket: Error sending message:', error);
      client.emit('message-error', { error: 'Failed to send message' });
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { senderId: string; propertyId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    try {
      await this.messagesService.markConversationAsRead(userId, data.senderId);

      // Notify sender that messages were read
      const senderRoom = `user-${data.senderId}`;
      this.server.to(senderRoom).emit('messages-read', {
        senderId: data.senderId,
        receiverId: userId,
        propertyId: data.propertyId,
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }
}
