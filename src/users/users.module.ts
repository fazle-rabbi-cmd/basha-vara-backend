import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { UserDocumentsService } from './user-documents.service.js';
import { UserDocumentsController } from './user-documents.controller.js';
import { ProfileCompletionService } from './profile-completion.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, UserDocumentsController],
  providers: [UsersService, UserDocumentsService, ProfileCompletionService],
  exports: [UsersService, ProfileCompletionService],
})
export class UsersModule {}
