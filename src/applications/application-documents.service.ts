import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadApplicationDocumentDto } from './dto/upload-application-document.dto.js';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ApplicationDocumentsService {
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
    applicationId: string,
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

    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: { property: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.tenantId !== userId) {
      throw new ForbiddenException('You can only upload documents to your own applications');
    }

    const fileExtension = this.getFileExtension(mimeType);
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const storageKey = `applications/${applicationId}/${documentType}/${Date.now()}_${sanitizedFileName}`;

    console.log(`Creating signed upload URL for bucket: application-documents, key: ${storageKey}`);

    const { data, error } = await this.supabase.storage
      .from('application-documents')
      .createSignedUploadUrl(storageKey, {
        upsert: false,
      });

    if (error) {
      console.error('Supabase signed URL creation error:', error);
      throw new BadRequestException(`Failed to create upload URL: ${error.message}`);
    }

    const publicUrl = `${this.supabase.storage.from('application-documents').getPublicUrl(storageKey).data.publicUrl}`;
    console.log('Created signed URL successfully, public URL:', publicUrl);

    return {
      uploadId: applicationId,
      uploadUrl: data.signedUrl,
      storageKey,
      publicUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async completeUpload(applicationId: string, userId: string, dto: UploadApplicationDocumentDto) {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: { property: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.tenantId !== userId) {
      throw new ForbiddenException('You can only upload documents to your own applications');
    }

    const publicUrl = this.supabase.storage.from('application-documents').getPublicUrl(dto.storageKey).data.publicUrl;

    const document = await this.prisma.applicationDocument.create({
      data: {
        applicationId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        fileUrl: publicUrl,
        fileSize: parseInt(dto.fileSize, 10),
        mimeType: dto.mimeType,
      },
    });

    console.log('Document created successfully:', document.id);

    return document;
  }

  async findByApplication(applicationId: string, userId: string) {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: { property: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.tenantId !== userId && application.property.landlordId !== userId) {
      throw new ForbiddenException('You do not have access to this application');
    }

    return this.prisma.applicationDocument.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async delete(documentId: string, userId: string) {
    const document = await this.prisma.applicationDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.application.tenantId !== userId) {
      throw new ForbiddenException('You can only delete your own documents');
    }

    const url = new URL(document.fileUrl);
    const pathParts = url.pathname.split('/');
    const storageKey = pathParts.slice(pathParts.indexOf('application-documents') + 1).join('/');

    if (storageKey) {
      const { error } = await this.supabase.storage
        .from('application-documents')
        .remove([storageKey]);

      if (error) {
        console.error(`Failed to delete file from storage: ${error.message}`);
      }
    }

    await this.prisma.applicationDocument.delete({
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
