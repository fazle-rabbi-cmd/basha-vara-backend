import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemPermission } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../services/redis.service.js';
import { AuditService } from '../services/audit.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<SystemPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.roles) {
      throw new ForbiddenException('Access denied: User not authenticated');
    }

    const userPermissions = await this.getUserPermissions(user.roles);

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      const handler = context.getHandler();
      const resource = handler.name || context.getClass().name;

      await this.audit.logAuthorizationAttempt(
        user.id,
        'permission_check',
        resource,
        false,
        request.ip,
        request.headers['user-agent'],
      );

      throw new ForbiddenException(
        `Access denied: Required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private async getUserPermissions(roles: string[]): Promise<SystemPermission[]> {
    const cacheKey = `user_permissions:${roles.join(',')}`;
    const cached = await this.redis.get(cacheKey);

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
    await this.redis.set(cacheKey, JSON.stringify(permissions), 3600);

    return permissions;
  }
}
