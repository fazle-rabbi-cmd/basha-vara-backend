import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadType } from './dto/create-upload-intent.dto.js';
import { UploadsService } from './uploads.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockStorageFrom = vi.fn();
const mockCreateClient = vi.fn(() => ({
  storage: { from: mockStorageFrom },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('UploadsService', () => {
  let service: UploadsService;
  let prisma: any;
  let configService: any;

  const buildService = async (withSupabase = true) => {
    configService = {
      get: vi.fn((key: string) => {
        if (!withSupabase) return undefined;
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_KEY') return 'service-key';
        return undefined;
      }),
    };

    const mockPrisma = {
      property: { findUnique: vi.fn() },
      propertyPhoto: {
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      user: { update: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    prisma = module.get(PrismaService);
    return { service, prisma };
  };

  const mockSupabaseBucket = () => {
    mockStorageFrom.mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://upload.url' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://public.url/file.jpg' },
      }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseBucket();
  });

  describe('createUploadIntent', () => {
    it('throws when Supabase not configured', async () => {
      await buildService(false);
      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROFILE_PHOTO,
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow('Storage service not configured');
    });

    it('rejects oversized files', async () => {
      await buildService();
      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROFILE_PHOTO,
          mimeType: 'image/jpeg',
          fileSize: String(11 * 1024 * 1024),
        } as any),
      ).rejects.toThrow('exceeds maximum');
    });

    it('rejects invalid mime type', async () => {
      await buildService();
      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROFILE_PHOTO,
          mimeType: 'application/x-msdownload',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow('Invalid file type');
    });

    it('creates intent for profile photo', async () => {
      const { service } = await buildService();

      const result = await service.createUploadIntent('user-1', [], {
        type: UploadType.PROFILE_PHOTO,
        mimeType: 'image/png',
        fileSize: '2048',
      } as any);

      expect(result.uploadUrl).toBe('https://upload.url');
      expect(result.storageKey).toContain('profiles/user-1/');
      expect(result.storageKey).toMatch(/\.png$/);
      expect(result.publicUrl).toBe('https://public.url/file.jpg');
      expect(result.expiresAt).toBeTruthy();
    });

    it('requires propertyId for property photos', async () => {
      const { service } = await buildService();
      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROPERTY_PHOTO,
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow('Property ID is required');
    });

    it('rejects property photo for missing property', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROPERTY_PHOTO,
          propertyId: 'bad',
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects property photo for non-owner non-admin', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue({ id: 'p1', landlordId: 'other' });

      await expect(
        service.createUploadIntent('user-1', ['TENANT'], {
          type: UploadType.PROPERTY_PHOTO,
          propertyId: 'p1',
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to upload for any property', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue({ id: 'p1', landlordId: 'other' });
      prisma.propertyPhoto.count.mockResolvedValue(0);

      const result = await service.createUploadIntent('admin-1', ['ADMIN'], {
        type: UploadType.PROPERTY_PHOTO,
        propertyId: 'p1',
        mimeType: 'image/jpeg',
        fileSize: '1024',
      } as any);

      expect(result.storageKey).toContain('properties/p1/');
      expect(result.storageKey).toMatch(/\.jpg$/);
    });

    it('rejects when max photos reached', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue({ id: 'p1', landlordId: 'user-1' });
      prisma.propertyPhoto.count.mockResolvedValue(20);

      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROPERTY_PHOTO,
          propertyId: 'p1',
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow('Maximum 20 photos');
    });

    it('handles signed URL creation error', async () => {
      const { service } = await buildService();
      mockStorageFrom.mockReturnValue({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'bucket missing' },
        }),
        getPublicUrl: vi.fn(),
      });

      await expect(
        service.createUploadIntent('user-1', [], {
          type: UploadType.PROFILE_PHOTO,
          mimeType: 'image/jpeg',
          fileSize: '1024',
        } as any),
      ).rejects.toThrow('Failed to create upload URL');
    });
  });

  describe('completePropertyPhoto', () => {
    it('creates photo record for owner', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue({ id: 'p1', landlordId: 'user-1' });
      prisma.propertyPhoto.create.mockResolvedValue({});

      await service.completePropertyPhoto('user-1', {
        propertyId: 'p1',
        storageKey: 'properties/p1/x.jpg',
        caption: 'Front',
        isPrimary: true,
        sortIndex: 2,
      } as any);

      expect(prisma.propertyPhoto.updateMany).toHaveBeenCalledWith({
        where: { propertyId: 'p1' },
        data: { isPrimary: false },
      });
      expect(prisma.propertyPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          propertyId: 'p1',
          storageKey: 'properties/p1/x.jpg',
          caption: 'Front',
          isPrimary: true,
          sortOrder: 2,
          url: 'https://public.url/file.jpg',
        }),
      });
    });

    it('rejects non-owner', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue({ id: 'p1', landlordId: 'other' });

      await expect(
        service.completePropertyPhoto('user-1', {
          propertyId: 'p1',
          storageKey: 'k',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects missing property', async () => {
      const { service, prisma } = await buildService();
      prisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.completePropertyPhoto('user-1', {
          propertyId: 'bad',
          storageKey: 'k',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('completeProfilePhoto', () => {
    it('updates user avatar and returns URL', async () => {
      const { service, prisma } = await buildService();
      prisma.user.update.mockResolvedValue({});

      const result = await service.completeProfilePhoto('user-1', 'profiles/user-1/x.jpg');

      expect(result).toBe('https://public.url/file.jpg');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: 'https://public.url/file.jpg' },
      });
    });
  });

  describe('deletePropertyPhoto', () => {
    const photoWithProperty = {
      id: 'photo-1',
      storageKey: 'properties/p1/x.jpg',
      property: { id: 'p1', landlordId: 'user-1' },
    };

    it('deletes photo for owner', async () => {
      const { service, prisma } = await buildService();
      prisma.propertyPhoto.findUnique.mockResolvedValue(photoWithProperty);
      prisma.propertyPhoto.delete.mockResolvedValue({});

      await service.deletePropertyPhoto('user-1', [], 'p1', 'photo-1');

      expect(mockStorageFrom).toHaveBeenCalledWith('basha-vara-uploads');
      expect(prisma.propertyPhoto.delete).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
      });
    });

    it('throws NotFoundException for missing photo', async () => {
      const { service, prisma } = await buildService();
      prisma.propertyPhoto.findUnique.mockResolvedValue(null);

      await expect(service.deletePropertyPhoto('user-1', [], 'p1', 'bad'))
        .rejects.toThrow(NotFoundException);
    });

    it('rejects non-owner non-admin', async () => {
      const { service, prisma } = await buildService();
      prisma.propertyPhoto.findUnique.mockResolvedValue(photoWithProperty);

      await expect(service.deletePropertyPhoto('other', ['TENANT'], 'p1', 'photo-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('allows admin to delete', async () => {
      const { service, prisma } = await buildService();
      prisma.propertyPhoto.findUnique.mockResolvedValue(photoWithProperty);
      prisma.propertyPhoto.delete.mockResolvedValue({});

      await service.deletePropertyPhoto('admin-1', ['ADMIN'], 'p1', 'photo-1');
      expect(prisma.propertyPhoto.delete).toHaveBeenCalled();
    });

    it('handles photo without storageKey', async () => {
      const { service, prisma } = await buildService();
      prisma.propertyPhoto.findUnique.mockResolvedValue({
        ...photoWithProperty,
        storageKey: null,
      });
      prisma.propertyPhoto.delete.mockResolvedValue({});

      await service.deletePropertyPhoto('user-1', [], 'p1', 'photo-1');
      expect(prisma.propertyPhoto.delete).toHaveBeenCalled();
    });
  });
});
