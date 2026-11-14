import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationDocumentsService } from './application-documents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockStorageFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ storage: { from: mockStorageFrom } })),
}));

describe('ApplicationDocumentsService', () => {
  let service: ApplicationDocumentsService;
  let prisma: any;

  const application = {
    id: 'app-1',
    tenantId: 'tenant-1',
    property: { id: 'prop-1', landlordId: 'landlord-1' },
  };

  const buildService = async (withSupabase = true) => {
    const configService = {
      get: vi.fn((key: string) => {
        if (!withSupabase) return undefined;
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_KEY') return 'key';
        return undefined;
      }),
    };

    const mockPrisma = {
      rentalApplication: { findUnique: vi.fn() },
      applicationDocument: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationDocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<ApplicationDocumentsService>(ApplicationDocumentsService);
    prisma = module.get(PrismaService);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageFrom.mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.url' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://public.url/doc.pdf' },
      }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  describe('createUploadIntent', () => {
    it('throws when Supabase not configured', async () => {
      await buildService(false);
      await expect(
        service.createUploadIntent('app-1', 'tenant-1', 'NID', 'nid.pdf', 100, 'application/pdf'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('rejects oversized file', async () => {
      await buildService();
      await expect(
        service.createUploadIntent('app-1', 'tenant-1', 'NID', 'nid.pdf', 6 * 1024 * 1024, 'application/pdf'),
      ).rejects.toThrow('exceeds maximum');
    });

    it('rejects invalid mime type', async () => {
      await buildService();
      await expect(
        service.createUploadIntent('app-1', 'tenant-1', 'NID', 'nid.exe', 100, 'application/x-msdownload'),
      ).rejects.toThrow('Invalid file type');
    });

    it('creates intent for own application', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);

      const result = await service.createUploadIntent(
        'app-1', 'tenant-1', 'NID', 'My NID Card.pdf', 1024, 'application/pdf',
      );

      expect(result.uploadUrl).toBe('https://signed.url');
      expect(result.storageKey).toContain('applications/app-1/NID/');
      expect(result.storageKey).toContain('my_nid_card.pdf');
      expect(result.publicUrl).toBe('https://public.url/doc.pdf');
    });

    it('throws NotFoundException for missing application', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(null);
      await expect(
        service.createUploadIntent('bad', 'u', 'NID', 'f.pdf', 1, 'application/pdf'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects non-tenant', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      await expect(
        service.createUploadIntent('app-1', 'other', 'NID', 'f.pdf', 1, 'application/pdf'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('handles signed URL error', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      mockStorageFrom.mockReturnValue({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'fail' },
        }),
      });
      await expect(
        service.createUploadIntent('app-1', 'tenant-1', 'NID', 'f.pdf', 1, 'application/pdf'),
      ).rejects.toThrow('Failed to create upload URL');
    });
  });

  describe('completeUpload', () => {
    it('creates document record', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      prisma.applicationDocument.create.mockResolvedValue({ id: 'doc-1' });

      const result = await service.completeUpload('app-1', 'tenant-1', {
        documentType: 'NID',
        fileName: 'nid.pdf',
        storageKey: 'applications/app-1/NID/x.pdf',
        fileSize: '1024',
        mimeType: 'application/pdf',
      } as any);

      expect(result.id).toBe('doc-1');
      expect(prisma.applicationDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-1',
          fileUrl: 'https://public.url/doc.pdf',
          fileSize: 1024,
        }),
      });
    });

    it('rejects non-tenant', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      await expect(
        service.completeUpload('app-1', 'other', { storageKey: 'k' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByApplication', () => {
    it('allows tenant to view documents', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      prisma.applicationDocument.findMany.mockResolvedValue([{ id: 'd1' }]);

      const result = await service.findByApplication('app-1', 'tenant-1');
      expect(result).toHaveLength(1);
    });

    it('allows landlord to view documents', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      prisma.applicationDocument.findMany.mockResolvedValue([]);

      await service.findByApplication('app-1', 'landlord-1');
      expect(prisma.applicationDocument.findMany).toHaveBeenCalled();
    });

    it('rejects unrelated user', async () => {
      await buildService();
      prisma.rentalApplication.findUnique.mockResolvedValue(application);
      await expect(service.findByApplication('app-1', 'stranger')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    const doc = {
      id: 'doc-1',
      fileUrl: 'https://test.supabase.co/storage/v1/object/public/application-documents/applications/app-1/NID/x.pdf',
      application: application,
    };

    it('deletes document for tenant', async () => {
      await buildService();
      prisma.applicationDocument.findUnique.mockResolvedValue(doc);
      prisma.applicationDocument.delete.mockResolvedValue({});

      await service.delete('doc-1', 'tenant-1');
      expect(prisma.applicationDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('throws NotFoundException for missing document', async () => {
      await buildService();
      prisma.applicationDocument.findUnique.mockResolvedValue(null);
      await expect(service.delete('bad', 'u')).rejects.toThrow(NotFoundException);
    });

    it('rejects non-tenant', async () => {
      await buildService();
      prisma.applicationDocument.findUnique.mockResolvedValue(doc);
      await expect(service.delete('doc-1', 'landlord-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
