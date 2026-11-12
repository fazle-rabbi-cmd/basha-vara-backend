import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDocumentsService } from './user-documents.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('User Documents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('me/documents')
export class UserDocumentsController {
  constructor(private readonly userDocumentsService: UserDocumentsService) {}

  @Post('upload-intent')
  @Roles('TENANT', 'LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create upload intent for user document' })
  @ApiResponse({ status: 200, description: 'Upload intent created successfully' })
  async createUploadIntent(
    @CurrentUser('id') userId: string,
    @Query('documentType') documentType: string,
    @Query('fileName') fileName: string,
    @Query('fileSize') fileSize: string,
    @Query('mimeType') mimeType: string,
  ) {
    return this.userDocumentsService.createUploadIntent(
      userId,
      documentType,
      fileName,
      parseInt(fileSize, 10),
      mimeType,
    );
  }

  @Post('complete')
  @Roles('TENANT', 'LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Complete document upload after file is uploaded to storage' })
  @ApiResponse({ status: 201, description: 'Document upload completed successfully' })
  async completeUpload(
    @CurrentUser('id') userId: string,
    @Body() dto: any,
  ) {
    return this.userDocumentsService.completeUpload(userId, dto);
  }

  @Get()
  @Roles('TENANT', 'LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get my documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getMyDocuments(
    @CurrentUser('id') userId: string,
  ) {
    return this.userDocumentsService.findByUser(userId);
  }

  @Get(':userId')
  @Roles('LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get documents for a specific user (landlord only)' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getUserDocuments(
    @Param('userId') userId: string,
  ) {
    return this.userDocumentsService.findByUser(userId);
  }

  @Delete(':documentId')
  @Roles('TENANT', 'LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.userDocumentsService.delete(documentId, userId);
  }
}
