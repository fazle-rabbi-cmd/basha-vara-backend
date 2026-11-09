import { Controller, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service.js';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto.js';
import { UploadIntentResponseDto } from './dto/upload-intent-response.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create upload intent' })
  @ApiResponse({ status: 200, type: UploadIntentResponseDto })
  async createUploadIntent(@Request() req: any, @Body() dto: CreateUploadIntentDto): Promise<UploadIntentResponseDto> {
    return this.uploadsService.createUploadIntent(req.user.userId, req.user.role, dto);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Complete property photo upload' })
  @ApiResponse({ status: 200, description: 'Upload completed successfully' })
  async completeUpload(@Request() req: any, @Body() dto: CompleteUploadDto): Promise<void> {
    return this.uploadsService.completePropertyPhoto(req.user.userId, dto);
  }

  @Post('complete-profile')
  @ApiOperation({ summary: 'Complete profile photo upload' })
  @ApiResponse({ status: 200, description: 'Profile photo uploaded successfully' })
  async completeProfileUpload(@Request() req: any, @Body() dto: { storageKey: string }): Promise<{ publicUrl: string }> {
    const publicUrl = await this.uploadsService.completeProfilePhoto(req.user.userId, dto.storageKey);
    return { publicUrl };
  }

  @Delete('properties/:propertyId/photos/:photoId')
  @ApiOperation({ summary: 'Delete property photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @Roles(Role.LANDLORD, Role.ADMIN)
  async deletePropertyPhoto(
    @Request() req: any,
    @Param('propertyId') propertyId: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.uploadsService.deletePropertyPhoto(req.user.userId, req.user.role, propertyId, photoId);
  }
}
