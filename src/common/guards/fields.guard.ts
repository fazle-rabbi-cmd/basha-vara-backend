import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemPermission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FIELD_PERMISSIONS_KEY } from '../decorators/fields.decorator.js';
import { CacheService } from '../services/cache.service.js';

@Injectable()
export class FieldPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const fieldPermissions = this.reflector.get<Record<string, SystemPermission[]>>(
      FIELD_PERMISSIONS_KEY,
      context.getHandler(),
    );

    if (!fieldPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.roles) {
      return true;
    }

    const userPermissions = await this.getUserPermissions(user.roles);

    const accessibleFields = Object.entries(fieldPermissions)
      .filter(([_, perms]) => perms.some((p) => userPermissions.includes(p)))
      .map(([field]) => field);

    request.accessibleFields = accessibleFields;

    return true;
  }

  private async getUserPermissions(roles: string[]): Promise<SystemPermission[]> {
    const cacheKey = `user_permissions:${roles.join(',')}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          name: {
            in: roles,
          },
        },
      },
      include: {
        permission: true,
      },
    });

    const permissions = rolePermissions.map((rp) => rp.permission.name as SystemPermission);
    await this.cache.set(cacheKey, JSON.stringify(permissions), 3600);

    return permissions;
  }
}
