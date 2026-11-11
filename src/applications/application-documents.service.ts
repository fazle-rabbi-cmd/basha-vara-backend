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
    const storageKey = `applications/${applicationId}/${documentType}/${Date.now()}_${fileName}`;

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

    const publicUrl = this.supabase.storage.from('basha-vara-uploads').getPublicUrl(dto.storageKey).data.publicUrl;

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

    const storageKey = document.fileUrl.split('/').slice(-1)[0];

    if (storageKey) {
      const { error } = await this.supabase.storage
        .from('basha-vara-uploads')
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
}
