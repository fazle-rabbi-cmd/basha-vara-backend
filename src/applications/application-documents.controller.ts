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
import { ApplicationDocumentsService } from './application-documents.service.js';
import { UploadApplicationDocumentDto } from './dto/upload-application-document.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Application Documents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications/:applicationId/documents')
export class ApplicationDocumentsController {
  constructor(private readonly applicationDocumentsService: ApplicationDocumentsService) {}

  @Post('upload-intent')
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create upload intent for application document' })
  @ApiResponse({ status: 200, description: 'Upload intent created successfully' })
  async createUploadIntent(
    @Param('applicationId') applicationId: string,
    @CurrentUser('id') userId: string,
    @Query('documentType') documentType: string,
    @Query('fileName') fileName: string,
    @Query('fileSize') fileSize: string,
    @Query('mimeType') mimeType: string,
  ) {
    return this.applicationDocumentsService.createUploadIntent(
      applicationId,
      userId,
      documentType,
      fileName,
      parseInt(fileSize, 10),
      mimeType,
    );
  }

  @Post('complete')
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Complete document upload after file is uploaded to storage' })
  @ApiResponse({ status: 201, description: 'Document upload completed successfully' })
  async completeUpload(
    @Param('applicationId') applicationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UploadApplicationDocumentDto,
  ) {
    return this.applicationDocumentsService.completeUpload(applicationId, userId, dto);
  }

  @Get()
  @Roles('TENANT', 'LANDLORD', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all documents for an application' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Param('applicationId') applicationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.applicationDocumentsService.findByApplication(applicationId, userId);
  }

  @Delete(':documentId')
  @Roles('TENANT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a document from application' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.applicationDocumentsService.delete(documentId, userId);
  }
}
