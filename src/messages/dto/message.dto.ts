import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ description: 'Receiver user ID' })
  @IsUUID()
  receiverId: string;

  @ApiProperty({ description: 'Message content', required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ description: 'Message type', enum: MessageType, required: false })
  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType;

  @ApiProperty({ description: 'Property ID for context', required: false })
  @IsUUID()
  @IsOptional()
  propertyId?: string;
}

export class UpdateMessageReadDto {
  @ApiProperty({ description: 'Mark message as read' })
  @IsOptional()
  isRead?: boolean;
}

export class MessageResponseDto {
  id: string;
  senderId: string;
  receiverId: string;
  propertyId?: string;
  content: string;
  messageType: MessageType;
  isRead: boolean;
  createdAt: Date;
  sender?: {
    id: string;
    fullName: string;
    email: string;
  };
  receiver?: {
    id: string;
    fullName: string;
    email: string;
  };
  property?: {
    id: string;
    title: string;
  };
}
