import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ContactMilestone, SystemPermission } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class ContactInfoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.id) {
      throw new ForbiddenException('Access denied: User not authenticated');
    }

    const targetUserId = request.params.id || request.body.userId;

    if (!targetUserId) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<SystemPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = await this.getUserPermissions(user.roles);

      const hasPermission = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Access denied: Required permission(s): ${requiredPermissions.join(', ')}`,
        );
      }
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        emailVisibility: true,
        phoneVisibility: true,
        revealContactAfterMilestone: true,
      },
    });

    if (!targetUser) {
      throw new ForbiddenException('User not found');
    }

    if (targetUser.revealContactAfterMilestone === 'NEVER') {
      request.returnMaskedContact = true;
      return true;
    }

    const milestoneReached = await this.checkMilestone(
      user.id,
      targetUserId,
      targetUser.revealContactAfterMilestone,
    );

    if (milestoneReached) {
      return true;
    }

    request.returnMaskedContact = true;
    return true;
  }

  private async checkMilestone(
    userId: string,
    targetUserId: string,
    milestone: ContactMilestone,
  ): Promise<boolean> {
    switch (milestone) {
      case 'VISIT_SCHEDULED': {
        const visit = await this.prisma.visitRequest.findFirst({
          where: {
            OR: [
              { tenantId: userId, property: { landlordId: targetUserId } },
              { tenantId: targetUserId, property: { landlordId: userId } },
            ],
            status: 'ACCEPTED',
          },
        });
        return !!visit;
      }

      case 'APPLICATION_SUBMITTED': {
        const application = await this.prisma.rentalApplication.findFirst({
          where: {
            OR: [
              { tenantId: userId, property: { landlordId: targetUserId } },
              { tenantId: targetUserId, property: { landlordId: userId } },
            ],
            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED'] },
          },
        });
        return !!application;
      }

      case 'APPLICATION_SHORTLISTED': {
        const shortlistedApp = await this.prisma.rentalApplication.findFirst({
          where: {
            OR: [
              { tenantId: userId, property: { landlordId: targetUserId } },
              { tenantId: targetUserId, property: { landlordId: userId } },
            ],
            status: 'SHORTLISTED',
          },
        });
        return !!shortlistedApp;
      }

      case 'APPLICATION_ACCEPTED': {
        const acceptedApp = await this.prisma.rentalApplication.findFirst({
          where: {
            OR: [
              { tenantId: userId, property: { landlordId: targetUserId } },
              { tenantId: targetUserId, property: { landlordId: userId } },
            ],
            status: 'SELECTED',
          },
        });
        return !!acceptedApp;
      }

      case 'PAYMENT_INITIATED':
        return false;

      default:
        return false;
    }
  }

  private async getUserPermissions(roles: string[]): Promise<SystemPermission[]> {
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

    return rolePermissions.map((rp) => rp.permission.name as SystemPermission);
  }
}
