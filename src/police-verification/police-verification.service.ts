import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeneratePoliceVerificationDto, PoliceVerificationResponseDto } from './dto/police-verification.dto.js';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PoliceVerificationService {
  constructor(private prisma: PrismaService) {}

  async generatePoliceVerification(userId: string, dto: GeneratePoliceVerificationDto): Promise<PoliceVerificationResponseDto> {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { landlord: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.landlordId !== userId) {
      throw new ForbiddenException('Only landlord can generate police verification');
    }

    const tenant = await this.prisma.user.findUnique({
      where: { id: dto.tenantId },
      include: { tenantProfile: true, applicationProfile: true, userDocuments: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const existingVerification = await this.prisma.policeVerification.findFirst({
      where: {
        tenantId: dto.tenantId,
        propertyId: dto.propertyId,
        status: { not: 'VERIFIED' },
      },
    });

    if (existingVerification) {
      throw new BadRequestException('Police verification already exists for this tenant and property');
    }

    const formData = await this.buildFormData(tenant, property);

    const verification = await this.prisma.policeVerification.create({
      data: {
        tenantId: dto.tenantId,
        propertyId: dto.propertyId,
        applicationId: dto.applicationId,
        landlordId: userId,
        status: 'PENDING',
        formData,
      },
    });

    return this.mapToResponse(verification);
  }

  async generatePdf(verificationId: string, userId: string): Promise<Buffer> {
    const verification = await this.prisma.policeVerification.findUnique({
      where: { id: verificationId },
      include: {
        tenant: {
          include: { tenantProfile: true, applicationProfile: true, userDocuments: true },
        },
        property: true,
        landlord: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Police verification not found');
    }

    const isLandlord = verification.landlordId === userId;
    const isTenant = verification.tenantId === userId;
    const isAdmin = await this.isUserAdmin(userId);

    if (!isLandlord && !isTenant && !isAdmin) {
      throw new ForbiddenException('You do not have permission to access this verification');
    }

    const pdfBuffer = await this.createPdfDocument(verification);

    await this.prisma.policeVerification.update({
      where: { id: verificationId },
      data: {
        status: 'GENERATED',
        pdfUrl: `police-verifications/${verificationId}.pdf`,
      },
    });

    return pdfBuffer;
  }

  async getPoliceVerifications(userId: string, userRoles: string[]): Promise<PoliceVerificationResponseDto[]> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    let where: any = {};

    if (!isAdmin) {
      where = {
        OR: [
          { tenantId: userId },
          { landlordId: userId },
        ],
      };
    }

    const verifications = await this.prisma.policeVerification.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            tenantProfile: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            addressLine: true,
            area: true,
            city: true,
          },
        },
        landlord: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return verifications.map((v) => this.mapToResponse(v));
  }

  async submitVerification(verificationId: string, userId: string): Promise<PoliceVerificationResponseDto> {
    const verification = await this.prisma.policeVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Police verification not found');
    }

    if (verification.tenantId !== userId) {
      throw new ForbiddenException('Only tenant can submit verification');
    }

    if (verification.status !== 'GENERATED') {
      throw new BadRequestException('Verification must be generated before submission');
    }

    const updatedVerification = await this.prisma.policeVerification.update({
      where: { id: verificationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    return this.mapToResponse(updatedVerification);
  }

  async verifyPoliceVerification(verificationId: string, userId: string): Promise<PoliceVerificationResponseDto> {
    const verification = await this.prisma.policeVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Police verification not found');
    }

    const isAdmin = await this.isUserAdmin(userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can verify police verification');
    }

    const updatedVerification = await this.prisma.policeVerification.update({
      where: { id: verificationId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    return this.mapToResponse(updatedVerification);
  }

  private async buildFormData(tenant: any, property: any): Promise<any> {
    const nidDocument = tenant.userDocuments?.find((d: any) => d.documentType === 'id');
    const profilePhoto = tenant.avatarUrl || '';

    return {
      tenantName: tenant.fullName,
      tenantNid: nidDocument?.fileName || 'Not provided',
      tenantPhone: tenant.phone || '',
      tenantEmail: tenant.email,
      tenantAddress: tenant.applicationProfile?.address || '',
      tenantOccupation: tenant.tenantProfile?.occupation || tenant.applicationProfile?.employmentStatus || '',
      tenantEmployer: tenant.applicationProfile?.employerName || '',
      tenantMonthlyIncome: tenant.applicationProfile?.monthlyIncome?.toString() || '',
      profilePhoto,
      propertyTitle: property.title,
      propertyAddress: `${property.addressLine}, ${property.area}, ${property.city}`,
      landlordName: property.landlord.fullName,
      landlordPhone: property.landlord.phone || '',
      landlordEmail: property.landlord.email,
      moveInDate: new Date().toISOString().split('T')[0],
      formDate: new Date().toISOString().split('T')[0],
    };
  }

  private async createPdfDocument(verification: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const formData = verification.formData;

      doc.fontSize(18).font('Helvetica-Bold').text('Dhaka Metropolitan Police', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text('Tenant Registration Form', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('Tenant Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${formData.tenantName}`);
      doc.text(`NID Number: ${formData.tenantNid}`);
      doc.text(`Phone: ${formData.tenantPhone}`);
      doc.text(`Email: ${formData.tenantEmail}`);
      doc.text(`Address: ${formData.tenantAddress}`);
      doc.text(`Occupation: ${formData.tenantOccupation}`);
      doc.text(`Employer: ${formData.tenantEmployer}`);
      doc.text(`Monthly Income: ${formData.tenantMonthlyIncome} BDT`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Property Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Property Title: ${formData.propertyTitle}`);
      doc.text(`Property Address: ${formData.propertyAddress}`);
      doc.text(`Move-in Date: ${formData.moveInDate}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Landlord Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Landlord Name: ${formData.landlordName}`);
      doc.text(`Landlord Phone: ${formData.landlordPhone}`);
      doc.text(`Landlord Email: ${formData.landlordEmail}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Verification Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Form Date: ${formData.formDate}`);
      doc.text(`Verification ID: ${verification.id}`);
      doc.moveDown(2);

      doc.fontSize(10).font('Helvetica').text(
        'This form is generated automatically by Basha Vara platform. Please submit this form to the nearest police station for tenant verification as per DMP regulations.',
        { align: 'center' }
      );
      doc.moveDown(1);
      doc.fontSize(8).font('Helvetica').text(
        'For questions, contact: support@bashavara.com',
        { align: 'center' }
      );

      doc.end();
    });
  }

  private async isUserAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.some((ur) => ur.role.name === 'ADMIN' || ur.role.name === 'SUPER_ADMIN');
  }

  private mapToResponse(verification: any): PoliceVerificationResponseDto {
    return {
      id: verification.id,
      tenantId: verification.tenantId,
      propertyId: verification.propertyId,
      applicationId: verification.applicationId,
      landlordId: verification.landlordId,
      status: verification.status,
      formData: verification.formData,
      pdfUrl: verification.pdfUrl,
      submittedAt: verification.submittedAt,
      verifiedAt: verification.verifiedAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }
}
