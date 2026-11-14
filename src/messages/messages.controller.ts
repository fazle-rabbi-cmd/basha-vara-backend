import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { SendMessageDto, MessageResponseDto } from './dto/message.dto.js';

@ApiTags('Messages')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to another user' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.sendMessage(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get messages between users' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getMessages(
    @CurrentUser('id') userId: string,
    @Query('userId') otherUserId?: string,
    @Query('propertyId') propertyId?: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.getMessages(userId, otherUserId, propertyId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  @ApiResponse({ status: 200, description: 'Conversations retrieved successfully' })
  async getConversations(
    @CurrentUser('id') userId: string,
  ): Promise<any[]> {
    return this.messagesService.getConversations(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ): Promise<void> {
    return this.messagesService.markAsRead(messageId, userId);
  }

  @Patch('conversation/:userId/read')
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  async markConversationAsRead(
    @CurrentUser('id') userId: string,
    @Param('userId') otherUserId: string,
  ): Promise<void> {
    return this.messagesService.markConversationAsRead(userId, otherUserId);
  }
}
