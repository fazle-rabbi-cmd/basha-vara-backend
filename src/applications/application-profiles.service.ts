import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApplicationProfileDto } from './dto/create-application-profile.dto.js';
import { UpdateApplicationProfileDto } from './dto/update-application-profile.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApplicationProfilesService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const profile = await this.prisma.applicationProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Application profile not found');
    }

    return profile;
  }

  async create(userId: string, dto: CreateApplicationProfileDto) {
    const existing = await this.prisma.applicationProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('Application profile already exists. Use update instead.');
    }

    return this.prisma.applicationProfile.create({
      data: {
        userId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        employmentStatus: dto.employmentStatus,
        monthlyIncome: dto.monthlyIncome !== undefined ? new Prisma.Decimal(dto.monthlyIncome) : null,
        hasPets: dto.hasPets ?? false,
        petDetails: dto.petDetails,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        references: dto.references,
      },
    });
  }

  async update(userId: string, dto: UpdateApplicationProfileDto) {
    const existing = await this.prisma.applicationProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Application profile not found');
    }

    return this.prisma.applicationProfile.update({
      where: { userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.employmentStatus !== undefined && { employmentStatus: dto.employmentStatus }),
        ...(dto.monthlyIncome !== undefined && { monthlyIncome: new Prisma.Decimal(dto.monthlyIncome) }),
        ...(dto.hasPets !== undefined && { hasPets: dto.hasPets }),
        ...(dto.petDetails !== undefined && { petDetails: dto.petDetails }),
        ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
        ...(dto.emergencyPhone !== undefined && { emergencyPhone: dto.emergencyPhone }),
        ...(dto.references !== undefined && { references: dto.references }),
      },
    });
  }

  async delete(userId: string) {
    const existing = await this.prisma.applicationProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Application profile not found');
    }

    await this.prisma.applicationProfile.delete({
      where: { userId },
    });
  }
}
