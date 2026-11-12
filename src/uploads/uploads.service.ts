import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUploadIntentDto, UploadType } from './dto/create-upload-intent.dto.js';
import { UploadIntentResponseDto } from './dto/upload-intent-response.dto.js';
import { CompleteUploadDto } from './dto/complete-upload.dto.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  private supabase: SupabaseClient;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  private readonly ALLOWED_PDF_TYPES = ['application/pdf'];
  private readonly MAX_PROPERTY_PHOTOS = 20;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not configured. Uploads will not work.');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async createUploadIntent(
    userId: string,
    userRoles: string[],
    dto: CreateUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    if (!this.supabase) {
      throw new BadRequestException('Storage service not configured');
    }

    const { type, propertyId, mimeType, fileSize } = dto;

    const fileSizeNum = parseInt(fileSize, 10);

    if (fileSizeNum > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const allowedTypes = type === UploadType.PROPERTY_PHOTO ? this.ALLOWED_IMAGE_TYPES : this.ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }

    if (type === UploadType.PROPERTY_PHOTO) {
      if (!propertyId) {
        throw new BadRequestException('Property ID is required for property photos');
      }

      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property) {
        throw new NotFoundException('Property not found');
      }

      if (property.landlordId !== userId && !userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN')) {
        throw new ForbiddenException('You do not own this property');
      }

      const photoCount = await this.prisma.propertyPhoto.count({
        where: { propertyId },
      });

      if (photoCount >= this.MAX_PROPERTY_PHOTOS) {
        throw new BadRequestException(`Maximum ${this.MAX_PROPERTY_PHOTOS} photos allowed per property`);
      }
    }

    const uploadId = uuidv4();
    const fileExtension = this.getFileExtension(mimeType);
    const storageKey = type === UploadType.PROPERTY_PHOTO
      ? `properties/${propertyId}/${uploadId}.${fileExtension}`
      : `profiles/${userId}/${uploadId}.${fileExtension}`;

    const { data, error } = await this.supabase.storage
      .from('basha-vara-uploads')
      .createSignedUploadUrl(storageKey, {
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`Failed to create upload URL: ${error.message}`);
    }

    const publicUrl = `${this.supabase.storage.from('basha-vara-uploads').getPublicUrl(storageKey).data.publicUrl}`;

    return {
      uploadId,
      uploadUrl: data.signedUrl,
      storageKey,
      publicUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async completePropertyPhoto(userId: string, dto: CompleteUploadDto): Promise<void> {
    const { propertyId, storageKey, caption, isPrimary, sortIndex } = dto;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property || property.landlordId !== userId) {
      throw new ForbiddenException('You do not own this property');
    }

    if (isPrimary) {
      await this.prisma.propertyPhoto.updateMany({
        where: { propertyId },
        data: { isPrimary: false },
      });
    }

    const publicUrl = this.supabase.storage.from('basha-vara-uploads').getPublicUrl(storageKey).data.publicUrl;

    await this.prisma.propertyPhoto.create({
      data: {
        propertyId,
        url: publicUrl,
        storageKey,
        caption,
        isPrimary: isPrimary || false,
        sortOrder: sortIndex || 0,
      },
    });
  }

  async completeProfilePhoto(userId: string, storageKey: string): Promise<string> {
    try {
      const publicUrl = this.supabase.storage.from('basha-vara-uploads').getPublicUrl(storageKey).data.publicUrl;

      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: publicUrl },
      });

      return publicUrl;
    } catch (error: any) {
      console.error('Profile photo update error:', error);
      throw new BadRequestException(`Failed to update profile photo: ${error.message}`);
    }
  }

  async deletePropertyPhoto(userId: string, userRoles: string[], propertyId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.propertyPhoto.findUnique({
      where: { id: photoId },
      include: { property: true },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.property.landlordId !== userId && !userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('You do not own this property');
    }

    if (photo.storageKey) {
      const { error } = await this.supabase.storage
        .from('basha-vara-uploads')
        .remove([photo.storageKey]);

      if (error) {
        console.error(`Failed to delete file from storage: ${error.message}`);
      }
    }

    await this.prisma.propertyPhoto.delete({
      where: { id: photoId },
    });
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/pjpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'application/pdf': 'pdf',
    };
    return extensions[mimeType] || 'bin';
  }
}
