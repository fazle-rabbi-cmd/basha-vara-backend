import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ApplicationStatus, PropertyStatus, UserStatus, VisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getMetrics() {
    const [
      totalProperties,
      publishedProperties,
      pausedProperties,
      rentedProperties,
      totalUsers,
      tenantRoles,
      landlordRoles,
      adminRoles,
      totalVisits,
      pendingVisits,
      totalApplications,
      submittedApplications,
    ] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.PUBLISHED } }),
      this.prisma.property.count({ where: { status: PropertyStatus.PAUSED } }),
      this.prisma.property.count({ where: { status: PropertyStatus.RENTED } }),
      this.prisma.user.count(),
      this.prisma.userRole.count({ where: { role: { name: 'TENANT' } } }),
      this.prisma.userRole.count({ where: { role: { name: 'LANDLORD' } } }),
      this.prisma.userRole.count({ where: { role: { name: { in: ['ADMIN', 'SUPER_ADMIN'] } } } }),
      this.prisma.visitRequest.count(),
      this.prisma.visitRequest.count({ where: { status: VisitStatus.PENDING } }),
      this.prisma.rentalApplication.count(),
      this.prisma.rentalApplication.count({ where: { status: ApplicationStatus.SUBMITTED } }),
    ]);

    return {
      properties: {
        total: totalProperties,
        published: publishedProperties,
        paused: pausedProperties,
        rented: rentedProperties,
      },
      users: {
        total: totalUsers,
        tenants: tenantRoles,
        landlords: landlordRoles,
        admins: adminRoles,
      },
      visits: {
        total: totalVisits,
        pending: pendingVisits,
      },
      applications: {
        total: totalApplications,
        submitted: submittedApplications,
      },
    };
  }

  async getProperties(query?: { search?: string; status?: PropertyStatus }) {
    const where: any = {};
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.search) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { area: { contains: s, mode: 'insensitive' } },
        { addressLine: { contains: s, mode: 'insensitive' } },
      ];
    }

    const properties = await this.prisma.property.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        photos: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        amenities: {
          include: { amenity: true },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            landlordProfile: true,
          },
        },
        _count: {
          select: {
            applications: true,
            visits: true,
            favourites: true,
          },
        },
      },
    });

    return properties.map((prop) => ({
      ...prop,
      amenities: prop.amenities.map((pa) => pa.amenity),
      applicationCount: prop._count.applications,
      visitCount: prop._count.visits,
      favouriteCount: prop._count.favourites,
    }));
  }

  async updatePropertyStatus(id: string, status: PropertyStatus) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return this.prisma.property.update({
      where: { id },
      data: { status },
      include: {
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async getUsers(query?: { search?: string; role?: string; status?: UserStatus }) {
    const where: any = {};
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.role) {
      where.roles = {
        some: { role: { name: query.role } },
      };
    }
    if (query?.search) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        tenantProfile: true,
        landlordProfile: true,
        _count: {
          select: {
            properties: true,
            applicationsMade: true,
            visitRequestsMade: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      status: u.status,
      roles: u.roles.map((r) => r.role.name),
      tenantProfile: u.tenantProfile,
      landlordProfile: u.landlordProfile,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      propertyCount: u._count.properties,
      applicationCount: u._count.applicationsMade,
      visitCount: u._count.visitRequestsMade,
    }));
  }

  async updateUserStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const isSuperAdmin = user.roles.some((r) => r.role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      throw new BadRequestException('Cannot modify super admin account');
    }

    const isAdmin = user.roles.some((r) => r.role.name === 'ADMIN');
    if (isAdmin) {
      throw new BadRequestException('Cannot modify admin account. Only super admin can perform this action.');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status },
      include: {
        roles: true,
      },
    });
  }

  async updateUserRole(id: string, roleName: string, currentUserRoles?: string[]) {
    const normalizedRoleName = roleName.toUpperCase();

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const isSuperAdmin = user.roles.some((r) => r.role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      throw new BadRequestException('Cannot modify super admin account');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: normalizedRoleName },
    });

    if (!role) {
      throw new NotFoundException(`Role ${normalizedRoleName} not found`);
    }

    if (currentUserRoles && !currentUserRoles.includes('SUPER_ADMIN')) {
      if (normalizedRoleName === 'ADMIN' || normalizedRoleName === 'SUPER_ADMIN') {
        throw new BadRequestException('Admins can only add tenant and landlord roles');
      }
    }

    const hasRole = user.roles.some((r) => r.role.name === normalizedRoleName);
    if (!hasRole) {
      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: role.id,
        },
      });
    }

    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
    return permissions;
  }

  async createPermission(name: string, description?: string, category?: string) {
    const existing = await this.prisma.permission.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('Permission with this name already exists');
    }

    const permission = await this.prisma.permission.create({
      data: {
        name,
        description: description || '',
        category: category || 'general',
      },
    });

    return permission;
  }

  async getRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: true },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot modify super admin role permissions');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      for (const permissionId of permissionIds) {
        await tx.rolePermission.create({
          data: {
            roleId,
            permissionId,
          },
        });
      }
    });

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async createRole(name: string, displayName: string, description?: string, permissionIds?: string[]) {
    const existingRole = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      throw new ConflictException(`Role with name ${name} already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name,
          displayName,
          description,
          isSystem: false,
        },
      });

      if (permissionIds && permissionIds.length > 0) {
        for (const permissionId of permissionIds) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId,
            },
          });
        }
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  async updateRole(id: string, displayName?: string, description?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (role.isSystem) {
      throw new BadRequestException(`Cannot modify system role ${role.name}`);
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(displayName && { displayName }),
        ...(description !== undefined && { description }),
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (role.isSystem) {
      throw new BadRequestException(`Cannot delete system role ${role.name}`);
    }

    if (role.userRoles.length > 0) {
      throw new BadRequestException(`Cannot delete role ${role.name} because it is assigned to users`);
    }

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: `Role ${role.name} deleted successfully` };
  }

  async removeUserRole(userId: string, roleName: string, currentUserRoles?: string[]) {
    const normalizedRoleName = roleName.toUpperCase();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const isSuperAdmin = user.roles.some((r) => r.role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      throw new BadRequestException('Cannot modify super admin account');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: normalizedRoleName },
    });

    if (!role) {
      throw new BadRequestException(`Role ${normalizedRoleName} not found`);
    }

    if (currentUserRoles && !currentUserRoles.includes('SUPER_ADMIN')) {
      if (normalizedRoleName === 'ADMIN' || normalizedRoleName === 'SUPER_ADMIN') {
        throw new BadRequestException('Admins can only remove tenant and landlord roles');
      }
    }

    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw new BadRequestException(`User does not have this role`);
    }

    if (userRole.role.isSystem) {
      const otherSystemRoles = await this.prisma.userRole.findMany({
        where: {
          userId,
          role: {
            isSystem: true,
          },
        },
      });

      if (otherSystemRoles.length <= 1) {
        throw new BadRequestException(`Cannot remove the last system role from user`);
      }
    }

    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });

    return { message: 'Role removed from user successfully' };
  }

  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomValues = randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    return password;
  }

  async createUser(email: string, fullName: string, phone?: string, role: string = 'ADMIN', currentUserRoles?: string[]) {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = role.toUpperCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const password = this.generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const roleObj = await this.prisma.role.findUnique({
      where: { name: normalizedRole },
    });
    if (!roleObj) {
      throw new BadRequestException(`Role ${normalizedRole} not found`);
    }

    if (currentUserRoles && !currentUserRoles.includes('SUPER_ADMIN')) {
      if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN') {
        throw new BadRequestException('Admins can only create tenant and landlord users');
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          fullName,
          phone,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleObj.id,
        },
      });

      return newUser;
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
      },
      password,
      message: 'User created successfully. Save this password - it will not be shown again.',
    };
  }

  async resetUserPassword(userId: string, currentUserRoles?: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isSuperAdmin = user.roles.some((r) => r.role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      throw new BadRequestException('Cannot modify super admin account');
    }

    const password = this.generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      password,
      message: 'Password reset successfully. Save this password - it will not be shown again.',
    };
  }
}
