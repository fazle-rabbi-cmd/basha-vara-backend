import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PropertyStatus, UserStatus } from '@prisma/client';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      property: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      userRole: {
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      visitRequest: { count: vi.fn() },
      rentalApplication: { count: vi.fn() },
      permission: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
      role: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      rolePermission: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('getMetrics', () => {
    it('returns aggregated metrics', async () => {
      const counts = [10, 5, 2, 3, 100, 60, 30, 10, 50, 20, 40, 15];
      prisma.property.count
        .mockResolvedValueOnce(counts[0])
        .mockResolvedValueOnce(counts[1])
        .mockResolvedValueOnce(counts[2])
        .mockResolvedValueOnce(counts[3]);
      prisma.user.count.mockResolvedValue(counts[4]);
      prisma.userRole.count
        .mockResolvedValueOnce(counts[5])
        .mockResolvedValueOnce(counts[6])
        .mockResolvedValueOnce(counts[7]);
      prisma.visitRequest.count
        .mockResolvedValueOnce(counts[8])
        .mockResolvedValueOnce(counts[9]);
      prisma.rentalApplication.count
        .mockResolvedValueOnce(counts[10])
        .mockResolvedValueOnce(counts[11]);

      const result = await service.getMetrics();

      expect(result.properties.total).toBe(10);
      expect(result.users.tenants).toBe(60);
      expect(result.visits.pending).toBe(20);
      expect(result.applications.submitted).toBe(15);
    });
  });

  describe('getProperties', () => {
    it('returns properties with counts', async () => {
      prisma.property.findMany.mockResolvedValue([{
        id: 'p1',
        title: 'Test',
        amenities: [{ amenity: { id: 'a1', name: 'WiFi' } }],
        _count: { applications: 2, visits: 3, favourites: 4 },
      }]);

      const result = await service.getProperties();

      expect(result[0].applicationCount).toBe(2);
      expect(result[0].visitCount).toBe(3);
      expect(result[0].favouriteCount).toBe(4);
      expect(result[0].amenities[0].id).toBe('a1');
    });

    it('filters by status and search', async () => {
      prisma.property.findMany.mockResolvedValue([]);
      await service.getProperties({ status: PropertyStatus.PUBLISHED, search: ' dhan ' });
      expect(prisma.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: PropertyStatus.PUBLISHED,
            OR: expect.arrayContaining([
              { title: { contains: 'dhan', mode: 'insensitive' } },
            ]),
          },
        }),
      );
    });
  });

  describe('updatePropertyStatus', () => {
    it('updates property status', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.property.update.mockResolvedValue({ id: 'p1', status: 'PAUSED' });

      const result = await service.updatePropertyStatus('p1', PropertyStatus.PAUSED);
      expect(result.status).toBe('PAUSED');
    });

    it('throws NotFoundException for missing property', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.updatePropertyStatus('bad', PropertyStatus.PAUSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsers', () => {
    it('returns users with role names and counts', async () => {
      prisma.user.findMany.mockResolvedValue([{
        id: 'u1',
        email: 'a@b.com',
        fullName: 'User',
        phone: '017',
        avatarUrl: null,
        status: 'ACTIVE',
        roles: [{ role: { name: 'TENANT' } }, { role: { name: 'LANDLORD' } }],
        tenantProfile: null,
        landlordProfile: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { properties: 2, applicationsMade: 3, visitRequestsMade: 1 },
      }]);

      const result = await service.getUsers();

      expect(result[0].roles).toEqual(['TENANT', 'LANDLORD']);
      expect(result[0].propertyCount).toBe(2);
      expect(result[0].applicationCount).toBe(3);
    });

    it('filters by role, status, and search', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.getUsers({ role: 'TENANT', status: UserStatus.ACTIVE, search: 'test' });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
            roles: { some: { role: { name: 'TENANT' } } },
          }),
        }),
      );
    });
  });

  describe('updateUserStatus', () => {
    it('updates regular user status', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'TENANT' } }],
      });
      prisma.user.update.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' });

      const result = await service.updateUserStatus('u1', UserStatus.SUSPENDED);
      expect(result.status).toBe('SUSPENDED');
    });

    it('throws NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserStatus('bad', UserStatus.ACTIVE)).rejects.toThrow(NotFoundException);
    });

    it('rejects modifying super admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'SUPER_ADMIN' } }],
      });
      await expect(service.updateUserStatus('u1', UserStatus.SUSPENDED)).rejects.toThrow('super admin');
    });

    it('rejects modifying admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'ADMIN' } }],
      });
      await expect(service.updateUserStatus('u1', UserStatus.SUSPENDED)).rejects.toThrow('admin account');
    });
  });

  describe('updateUserRole', () => {
    const userWithTenant = {
      id: 'u1',
      roles: [{ role: { name: 'TENANT' } }],
    };

    it('adds role to user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(userWithTenant)
        .mockResolvedValueOnce({ ...userWithTenant, roles: [{ role: { name: 'LANDLORD' } }] });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-2', name: 'LANDLORD' });
      prisma.userRole.create.mockResolvedValue({});

      const result = await service.updateUserRole('u1', 'landlord');
      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'u1', roleId: 'role-2' },
      });
      expect(result).toBeDefined();
    });

    it('skips create when user already has role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', roles: [{ role: { name: 'LANDLORD' } }] })
        .mockResolvedValueOnce({ id: 'u1', roles: [{ role: { name: 'LANDLORD' } }] });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-2', name: 'LANDLORD' });

      await service.updateUserRole('u1', 'LANDLORD');
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserRole('bad', 'TENANT')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for missing role', async () => {
      prisma.user.findUnique.mockResolvedValue(userWithTenant);
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.updateUserRole('u1', 'UNKNOWN')).rejects.toThrow(NotFoundException);
    });

    it('prevents non-super-admin from assigning admin roles', async () => {
      prisma.user.findUnique.mockResolvedValue(userWithTenant);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
      await expect(
        service.updateUserRole('u1', 'ADMIN', ['ADMIN']),
      ).rejects.toThrow('only add tenant and landlord');
    });

    it('allows super admin to assign admin role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(userWithTenant)
        .mockResolvedValueOnce(userWithTenant);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
      prisma.userRole.create.mockResolvedValue({});

      await service.updateUserRole('u1', 'ADMIN', ['SUPER_ADMIN']);
      expect(prisma.userRole.create).toHaveBeenCalled();
    });

    it('rejects modifying super admin target', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'SUPER_ADMIN' } }],
      });
      await expect(service.updateUserRole('u1', 'TENANT')).rejects.toThrow('super admin');
    });
  });

  describe('getPermissions / createPermission', () => {
    it('returns permissions', async () => {
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1', name: 'perm' }]);
      const result = await service.getPermissions();
      expect(result).toHaveLength(1);
    });

    it('creates permission', async () => {
      prisma.permission.findUnique.mockResolvedValue(null);
      prisma.permission.create.mockResolvedValue({ id: 'p1', name: 'new.perm' });

      const result = await service.createPermission('new.perm', 'desc', 'cat');
      expect(result.id).toBe('p1');
    });

    it('rejects duplicate permission', async () => {
      prisma.permission.findUnique.mockResolvedValue({ id: 'p1' });
      await expect(service.createPermission('dup')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRoles', () => {
    it('returns roles with permissions', async () => {
      prisma.role.findMany.mockResolvedValue([{
        id: 'r1',
        name: 'TENANT',
        description: 'Tenant role',
        rolePermissions: [{ permission: { id: 'p1', name: 'perm1' } }],
      }]);

      const result = await service.getRoles();
      expect(result[0].permissions).toHaveLength(1);
      expect(result[0].name).toBe('TENANT');
    });
  });

  describe('updateRolePermissions', () => {
    it('replaces role permissions in transaction', async () => {
      prisma.role.findUnique
        .mockResolvedValueOnce({ id: 'r1', name: 'TENANT', rolePermissions: [] })
        .mockResolvedValueOnce({ id: 'r1', name: 'TENANT' });

      const tx = {
        rolePermission: {
          deleteMany: vi.fn(),
          create: vi.fn(),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await service.updateRolePermissions('r1', ['p1', 'p2']);

      expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r1' } });
      expect(tx.rolePermission.create).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException for missing role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.updateRolePermissions('bad', [])).rejects.toThrow(NotFoundException);
    });

    it('rejects modifying super admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'SUPER_ADMIN', rolePermissions: [] });
      await expect(service.updateRolePermissions('r1', [])).rejects.toThrow('super admin');
    });
  });

  describe('createRole', () => {
    it('creates role with permissions', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          role: {
            create: vi.fn().mockResolvedValue({ id: 'r-new', name: 'CUSTOM' }),
            findUnique: vi.fn().mockResolvedValue({ id: 'r-new', name: 'CUSTOM' }),
          },
          rolePermission: { create: vi.fn() },
        };
        return cb(tx);
      });

      const result = await service.createRole('CUSTOM', 'Custom Role', 'desc', ['p1']);
      expect(result).toBeDefined();
    });

    it('rejects duplicate role name', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'EXISTING' });
      await expect(service.createRole('EXISTING', 'X')).rejects.toThrow(ConflictException);
    });
  });

  describe('updateRole', () => {
    it('updates non-system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'CUSTOM', isSystem: false });
      prisma.role.update.mockResolvedValue({ id: 'r1', displayName: 'New' });

      const result = await service.updateRole('r1', 'New', 'desc');
      expect(result.displayName).toBe('New');
    });

    it('throws NotFoundException for missing role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.updateRole('bad')).rejects.toThrow(NotFoundException);
    });

    it('rejects modifying system role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'TENANT', isSystem: true });
      await expect(service.updateRole('r1', 'X')).rejects.toThrow('system role');
    });
  });

  describe('deleteRole', () => {
    it('deletes unused non-system role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'CUSTOM',
        isSystem: false,
        userRoles: [],
      });
      prisma.role.delete.mockResolvedValue({});

      const result = await service.deleteRole('r1');
      expect(result.message).toContain('deleted successfully');
    });

    it('throws NotFoundException for missing role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.deleteRole('bad')).rejects.toThrow(NotFoundException);
    });

    it('rejects deleting system role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r1', name: 'TENANT', isSystem: true, userRoles: [],
      });
      await expect(service.deleteRole('r1')).rejects.toThrow('system role');
    });

    it('rejects deleting role assigned to users', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r1', name: 'CUSTOM', isSystem: false, userRoles: [{ id: 'ur1' }],
      });
      await expect(service.deleteRole('r1')).rejects.toThrow('assigned to users');
    });
  });

  describe('removeUserRole', () => {
    const tenantUser = {
      id: 'u1',
      roles: [{ role: { name: 'TENANT', isSystem: true } }],
    };

    it('removes role from user', async () => {
      prisma.user.findUnique.mockResolvedValue(tenantUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-t', name: 'TENANT' });
      prisma.userRole.findUnique.mockResolvedValue({
        userId: 'u1',
        roleId: 'role-t',
        role: { isSystem: false },
      });
      prisma.userRole.delete.mockResolvedValue({});

      const result = await service.removeUserRole('u1', 'tenant');
      expect(result.message).toContain('removed');
      expect(prisma.userRole.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.removeUserRole('bad', 'TENANT')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for missing role', async () => {
      prisma.user.findUnique.mockResolvedValue(tenantUser);
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.removeUserRole('u1', 'UNKNOWN')).rejects.toThrow(BadRequestException);
    });

    it('rejects removing role user does not have', async () => {
      prisma.user.findUnique.mockResolvedValue(tenantUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-l', name: 'LANDLORD' });
      prisma.userRole.findUnique.mockResolvedValue(null);
      await expect(service.removeUserRole('u1', 'LANDLORD')).rejects.toThrow('does not have this role');
    });

    it('prevents non-super-admin from removing admin roles', async () => {
      prisma.user.findUnique.mockResolvedValue(tenantUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-a', name: 'ADMIN' });
      await expect(service.removeUserRole('u1', 'ADMIN', ['ADMIN'])).rejects.toThrow(
        'only remove tenant and landlord',
      );
    });

    it('rejects removing last system role', async () => {
      prisma.user.findUnique.mockResolvedValue(tenantUser);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-t', name: 'TENANT' });
      prisma.userRole.findUnique.mockResolvedValue({
        userId: 'u1',
        roleId: 'role-t',
        role: { isSystem: true },
      });
      prisma.userRole.findMany.mockResolvedValue([{ id: 'ur1' }]);

      await expect(service.removeUserRole('u1', 'TENANT')).rejects.toThrow('last system role');
    });

    it('rejects modifying super admin target', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'SUPER_ADMIN' } }],
      });
      await expect(service.removeUserRole('u1', 'TENANT')).rejects.toThrow('super admin');
    });
  });

  describe('createUser', () => {
    it('creates user with generated password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-t', name: 'TENANT' });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue({
            id: 'new-user',
            email: 'new@e.com',
            fullName: 'New User',
            phone: '017',
            status: 'ACTIVE',
          }) },
          userRole: { create: vi.fn() },
        };
        return cb(tx);
      });

      const result = await service.createUser('New@E.com ', 'New User', '017', 'tenant');

      expect(result.user.email).toBe('new@e.com');
      expect(result.password).toHaveLength(16);
      expect(result.message).toContain('Save this password');
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createUser('dup@e.com', 'X')).rejects.toThrow(ConflictException);
    });

    it('rejects unknown role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.createUser('a@b.com', 'X', undefined, 'UNKNOWN')).rejects.toThrow('not found');
    });

    it('prevents non-super-admin from creating admin users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-a', name: 'ADMIN' });
      await expect(
        service.createUser('a@b.com', 'X', undefined, 'ADMIN', ['ADMIN']),
      ).rejects.toThrow('only create tenant and landlord');
    });
  });

  describe('resetUserPassword', () => {
    it('resets password for regular user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'TENANT' } }],
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.resetUserPassword('u1');
      expect(result.password).toHaveLength(16);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('throws NotFoundException for missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetUserPassword('bad')).rejects.toThrow(NotFoundException);
    });

    it('rejects resetting super admin password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        roles: [{ role: { name: 'SUPER_ADMIN' } }],
      });
      await expect(service.resetUserPassword('u1')).rejects.toThrow('super admin');
    });
  });
});
