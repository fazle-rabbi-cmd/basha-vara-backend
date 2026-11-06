import { Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, PropertyStatus, Role, UserStatus, VisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

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
      this.prisma.userRole.count({ where: { role: Role.TENANT } }),
      this.prisma.userRole.count({ where: { role: Role.LANDLORD } }),
      this.prisma.userRole.count({ where: { role: Role.ADMIN } }),
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

  async getUsers(query?: { search?: string; role?: Role; status?: UserStatus }) {
    const where: any = {};
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.role) {
      where.roles = {
        some: { role: query.role },
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
        roles: true,
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
      roles: u.roles.map((r) => r.role),
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
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { status },
      include: {
        roles: true,
      },
    });
  }

  async updateUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const hasRole = user.roles.some((r) => r.role === role);
    if (!hasRole) {
      await this.prisma.userRole.create({
        data: {
          userId: id,
          role,
        },
      });
    }

    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
  }
}
