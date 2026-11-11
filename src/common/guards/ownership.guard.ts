import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RESOURCE_KEY, RESOURCE_ID_PARAM } from '../decorators/ownership.decorator.js';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(RESOURCE_KEY, context.getHandler());
    const resourceIdParam = this.reflector.get<string>(
      RESOURCE_ID_PARAM,
      context.getHandler(),
    );

    if (!resource || !resourceIdParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const resourceId = request.params[resourceIdParam];

    if (!user || !resourceId) {
      throw new ForbiddenException('Access denied: Invalid request');
    }

    const isOwner = await this.checkOwnership(resource, resourceId, user.id);

    if (!isOwner) {
      throw new ForbiddenException('Access denied: You do not own this resource');
    }

    return true;
  }

  private async checkOwnership(resource: string, resourceId: string, userId: string): Promise<boolean> {
    switch (resource) {
      case 'property':
        const property = await this.prisma.property.findUnique({
          where: { id: resourceId },
          select: { landlordId: true },
        });
        return property?.landlordId === userId;

      case 'visit':
        const visit = await this.prisma.visitRequest.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
        return visit?.tenantId === userId;

      case 'application':
        const application = await this.prisma.rentalApplication.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
        return application?.tenantId === userId;

      case 'favourite':
        const favourite = await this.prisma.favourite.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
        return favourite?.tenantId === userId;

      default:
        return false;
    }
  }
}
