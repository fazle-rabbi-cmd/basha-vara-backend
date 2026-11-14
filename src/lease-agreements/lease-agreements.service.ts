import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLeaseAgreementDto, UpdateLeaseAgreementDto, LeaseAgreementResponseDto } from './dto/lease-agreement.dto.js';
import { LeaseStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';

@Injectable()
export class LeaseAgreementsService {
  constructor(private prisma: PrismaService) {}

  async createLeaseAgreement(userId: string, dto: CreateLeaseAgreementDto): Promise<LeaseAgreementResponseDto> {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: dto.applicationId },
      include: { property: true, tenant: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.property.landlordId !== userId) {
      throw new BadRequestException('Only landlord can create lease agreement');
    }

    if (application.status !== 'SELECTED') {
      throw new BadRequestException('Lease agreement can only be created for selected applications');
    }

    const existingLease = await this.prisma.leaseAgreement.findUnique({
      where: { applicationId: dto.applicationId },
    });

    if (existingLease) {
      throw new BadRequestException('Lease agreement already exists for this application');
    }

    const leaseAgreement = await this.prisma.leaseAgreement.create({
      data: {
        applicationId: dto.applicationId,
        landlordId: application.property.landlordId,
        tenantId: application.tenantId,
        propertyId: application.propertyId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        rentAmount: application.property.rentAmount,
        depositAmount: application.property.depositAmount || 0,
        terms: dto.terms || this.getDefaultTerms(),
        status: LeaseStatus.PENDING_SIGNATURE,
      },
    });

    return this.mapToResponse(leaseAgreement);
  }

  async generateLeasePdf(leaseId: string): Promise<string> {
    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { id: leaseId },
      include: {
        landlord: true,
        tenant: true,
        property: true,
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease agreement not found');
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<string>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64Pdf = pdfBuffer.toString('base64');
        resolve(`data:application/pdf;base64,${base64Pdf}`);
      });
    });

    doc.fontSize(20).text('LEASE AGREEMENT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);

    doc.text(`Landlord: ${lease.landlord.fullName}`);
    doc.text(`Tenant: ${lease.tenant.fullName}`);
    doc.text(`Property: ${lease.property.title}`);
    doc.text(`Address: ${lease.property.addressLine}, ${lease.property.area}, ${lease.property.city}`);
    doc.moveDown();

    doc.text(`Rent Amount: ${lease.rentAmount} BDT/month`);
    doc.text(`Security Deposit: ${lease.depositAmount} BDT`);
    doc.text(`Lease Start Date: ${lease.startDate.toISOString().split('T')[0]}`);
    doc.text(`Lease End Date: ${lease.endDate.toISOString().split('T')[0]}`);
    doc.moveDown();

    doc.fontSize(14).text('Terms and Conditions', { underline: true });
    doc.fontSize(12);
    doc.moveDown();

    if (typeof lease.terms === 'string') {
      doc.text(lease.terms);
    } else {
      const terms = lease.terms as any;
      if (terms.description) {
        doc.text(terms.description);
      }
      if (terms.customTerms) {
        doc.text(terms.customTerms);
      }
    }

    doc.moveDown();
    doc.text(`Landlord Signature: ${lease.landlordSigned ? 'SIGNED' : 'PENDING'}`);
    doc.text(`Tenant Signature: ${lease.tenantSigned ? 'SIGNED' : 'PENDING'}`);

    if (lease.signedAt) {
      doc.text(`Signed At: ${lease.signedAt.toISOString()}`);
    }

    doc.end();

    const pdfUrl = await pdfPromise;

    await this.prisma.leaseAgreement.update({
      where: { id: leaseId },
      data: { pdfUrl },
    });

    return pdfUrl;
  }

  async updateLeaseAgreement(
    leaseId: string,
    userId: string,
    dto: UpdateLeaseAgreementDto,
  ): Promise<LeaseAgreementResponseDto> {
    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { id: leaseId },
    });

    if (!lease) {
      throw new NotFoundException('Lease agreement not found');
    }

    if (lease.landlordId !== userId && lease.tenantId !== userId) {
      throw new BadRequestException('You are not authorized to update this lease agreement');
    }

    const updateData: any = {};

    if (dto.landlordSignatureData && lease.landlordId === userId) {
      updateData.landlordSignatureData = dto.landlordSignatureData;
      updateData.landlordSigned = true;
    }

    if (dto.tenantSignatureData && lease.tenantId === userId) {
      updateData.tenantSignatureData = dto.tenantSignatureData;
      updateData.tenantSigned = true;
    }

    if (dto.status) {
      updateData.status = dto.status;
    }

    if (lease.landlordSigned && lease.tenantSigned && !lease.signedAt) {
      updateData.signedAt = new Date();
      updateData.status = LeaseStatus.SIGNED;
    }

    const updatedLease = await this.prisma.leaseAgreement.update({
      where: { id: leaseId },
      data: updateData,
    });

    return this.mapToResponse(updatedLease);
  }

  async getLeaseAgreementById(leaseId: string): Promise<LeaseAgreementResponseDto> {
    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { id: leaseId },
    });

    if (!lease) {
      throw new NotFoundException('Lease agreement not found');
    }

    return this.mapToResponse(lease);
  }

  async getLeaseAgreementByApplication(applicationId: string): Promise<LeaseAgreementResponseDto> {
    const lease = await this.prisma.leaseAgreement.findUnique({
      where: { applicationId },
    });

    if (!lease) {
      throw new NotFoundException('Lease agreement not found');
    }

    return this.mapToResponse(lease);
  }

  private getDefaultTerms(): any {
    return {
      description: 'Standard lease terms apply. Tenant agrees to pay rent on time, maintain the property in good condition, and follow all building rules. Landlord agrees to provide the property in good condition and make necessary repairs.',
      customTerms: '',
    };
  }

  private mapToResponse(lease: any): LeaseAgreementResponseDto {
    return {
      id: lease.id,
      applicationId: lease.applicationId,
      landlordId: lease.landlordId,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      startDate: lease.startDate,
      endDate: lease.endDate,
      rentAmount: lease.rentAmount.toString(),
      depositAmount: lease.depositAmount.toString(),
      terms: lease.terms,
      status: lease.status,
      landlordSigned: lease.landlordSigned,
      tenantSigned: lease.tenantSigned,
      signedAt: lease.signedAt,
      pdfUrl: lease.pdfUrl,
      landlordSignatureData: lease.landlordSignatureData,
      tenantSignatureData: lease.tenantSignatureData,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
    };
  }
}
