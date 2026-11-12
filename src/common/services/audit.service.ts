import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  success: boolean;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: AuditLog): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details,
          success: data.success,
          ip: data.ip,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  async logAuthorizationAttempt(
    userId: string,
    action: string,
    resource: string,
    success: boolean,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      success,
      ip,
      userAgent,
    });
  }

  async getUserAuditLogs(userId: string, limit: number = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getResourceAuditLogs(resource: string, resourceId?: string, limit: number = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        resource,
        ...(resourceId && { resourceId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
