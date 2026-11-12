import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class UserDocumentsService {
  private supabase: SupabaseClient;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not configured. Document uploads will not work.');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async createUploadIntent(
    userId: string,
    documentType: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ) {
    if (!this.supabase) {
      throw new BadRequestException('Storage service not configured');
    }

    if (fileSize > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!this.ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Invalid file type. Allowed: ${this.ALLOWED_DOCUMENT_TYPES.join(', ')}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fileExtension = this.getFileExtension(mimeType);
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const storageKey = `user-documents/${userId}/${documentType}/${Date.now()}_${sanitizedFileName}`;

    console.log(`Creating signed upload URL for bucket: basha-vara-uploads, key: ${storageKey}`);

    const { data, error } = await this.supabase.storage
      .from('basha-vara-uploads')
      .createSignedUploadUrl(storageKey, {
        upsert: false,
      });

    if (error) {
      console.error('Supabase signed URL creation error:', error);
      throw new BadRequestException(`Failed to create upload URL: ${error.message}`);
    }

    const publicUrl = `${this.supabase.storage.from('basha-vara-uploads').getPublicUrl(storageKey).data.publicUrl}`;
    console.log('Created signed URL successfully, public URL:', publicUrl);

    return {
      uploadId: userId,
      uploadUrl: data.signedUrl,
      storageKey,
      publicUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async completeUpload(userId: string, dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const publicUrl = this.supabase.storage.from('basha-vara-uploads').getPublicUrl(dto.storageKey).data.publicUrl;

    const document = await this.prisma.userDocument.create({
      data: {
        userId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        fileUrl: publicUrl,
        fileSize: parseInt(dto.fileSize, 10),
        mimeType: dto.mimeType,
      },
    });

    console.log('User document created successfully:', document.id);

    return document;
  }

  async findByUser(userId: string, requestingUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async delete(documentId: string, userId: string) {
    const document = await this.prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.userId !== userId) {
      throw new ForbiddenException('You can only delete your own documents');
    }

    const url = new URL(document.fileUrl);
    const pathParts = url.pathname.split('/');
    const storageKey = pathParts.slice(pathParts.indexOf('basha-vara-uploads') + 1).join('/');

    if (storageKey) {
      const { error } = await this.supabase.storage
        .from('basha-vara-uploads')
        .remove([storageKey]);

      if (error) {
        console.error(`Failed to delete file from storage: ${error.message}`);
      }
    }

    await this.prisma.userDocument.delete({
      where: { id: documentId },
    });
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'application/pdf': 'pdf',
    };
    return extensions[mimeType] || 'bin';
  }

  private sanitizeFileName(fileName: string): string {
    const extension = fileName.split('.').pop() || '';
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

    const sanitized = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return `${sanitized}.${extension}`;
  }
}
