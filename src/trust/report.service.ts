import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReportDto, ResolveReportDto, ReportResponseDto } from './dto/report.dto.js';
import { ReportStatus, NotificationType } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, dto: CreateReportDto): Promise<ReportResponseDto> {
    // Validate target exists
    await this.validateTarget(dto.targetType, dto.targetId);

    // Check if user already reported this target
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: { not: ReportStatus.DISMISSED },
      },
    });

    if (existing) {
      throw new BadRequestException('You have already reported this item');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
        status: ReportStatus.PENDING,
      },
      include: {
        reporter: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Notify admins
    await this.notifyAdmins(report);

    return this.mapToResponse(report);
  }

  async getReports(userId: string, userRoles: string[]): Promise<ReportResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    let where: any = {};

    if (!isAdmin) {
      where = { reporterId: userId };
    }

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reports.map((r) => this.mapToResponse(r));
  }

  async getPendingReports(): Promise<ReportResponseDto[]> {
    const reports = await this.prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      include: {
        reporter: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reports.map((r) => this.mapToResponse(r));
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto): Promise<ReportResponseDto> {
    const isAdmin = await this.isUserAdmin(adminId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can resolve reports');
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.DISMISSED) {
      throw new BadRequestException('Report already resolved');
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        resolver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Notify reporter
    await this.prisma.notification.create({
      data: {
        userId: report.reporterId,
        type: NotificationType.REPORT_RESOLVED,
        title: `Report ${dto.status}`,
        message: `Your report has been ${dto.status.toLowerCase()}. ${dto.resolution || ''}`,
        data: { reportId, status: dto.status, resolution: dto.resolution },
      },
    });

    return this.mapToResponse(updated);
  }

  private async validateTarget(targetType: string, targetId: string): Promise<void> {
    switch (targetType) {
      case 'LISTING':
        const property = await this.prisma.property.findUnique({ where: { id: targetId } });
        if (!property) throw new NotFoundException('Property not found');
        break;
      case 'USER':
        const user = await this.prisma.user.findUnique({ where: { id: targetId } });
        if (!user) throw new NotFoundException('User not found');
        break;
      case 'MESSAGE':
        const message = await this.prisma.message.findUnique({ where: { id: targetId } });
        if (!message) throw new NotFoundException('Message not found');
        break;
      default:
        throw new BadRequestException('Invalid target type');
    }
  }

  private async notifyAdmins(report: any): Promise<void> {
    const admins = await this.prisma.userRole.findMany({
      where: {
        role: {
          name: {
            in: ['ADMIN', 'SUPER_ADMIN'],
          },
        },
      },
      include: {
        user: true,
      },
    });

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          userId: admin.userId,
          type: NotificationType.NEW_REPORT,
          title: 'New Report Submitted',
          message: `A new ${report.targetType.toLowerCase()} report has been submitted. Reason: ${report.reason}`,
          data: { reportId: report.id, targetType: report.targetType, targetId: report.targetId },
        },
      });
    }
  }

  private async isUserAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.name === 'ADMIN' || ur.role.name === 'SUPER_ADMIN');
  }

  private mapToResponse(report: any): ReportResponseDto {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      resolution: report.resolution,
      resolvedBy: report.resolvedBy,
      resolvedAt: report.resolvedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      reporter: report.reporter ? {
        id: report.reporter.id,
        fullName: report.reporter.fullName,
        email: report.reporter.email,
      } : undefined,
      resolver: report.resolver ? {
        id: report.resolver.id,
        fullName: report.resolver.fullName,
      } : undefined,
    };
  }
}
