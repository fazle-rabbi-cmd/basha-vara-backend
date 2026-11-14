import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaseAgreementsService } from './lease-agreements.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateLeaseAgreementDto, UpdateLeaseAgreementDto, LeaseAgreementResponseDto } from './dto/lease-agreement.dto.js';

@ApiTags('Lease Agreements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('lease-agreements')
export class LeaseAgreementsController {
  constructor(private readonly leaseAgreementsService: LeaseAgreementsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a lease agreement' })
  @ApiResponse({ status: 201, description: 'Lease agreement created successfully', type: LeaseAgreementResponseDto })
  async createLeaseAgreement(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateLeaseAgreementDto,
  ): Promise<LeaseAgreementResponseDto> {
    return this.leaseAgreementsService.createLeaseAgreement(userId, dto);
  }

  @Post(':id/generate-pdf')
  @ApiOperation({ summary: 'Generate PDF for lease agreement' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  async generateLeasePdf(
    @Param('id') leaseId: string,
  ): Promise<{ pdfUrl: string }> {
    const pdfUrl = await this.leaseAgreementsService.generateLeasePdf(leaseId);
    return { pdfUrl };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lease agreement (signatures, status)' })
  @ApiResponse({ status: 200, description: 'Lease agreement updated successfully', type: LeaseAgreementResponseDto })
  async updateLeaseAgreement(
    @Param('id') leaseId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLeaseAgreementDto,
  ): Promise<LeaseAgreementResponseDto> {
    return this.leaseAgreementsService.updateLeaseAgreement(leaseId, userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lease agreement by ID' })
  @ApiResponse({ status: 200, description: 'Lease agreement retrieved successfully', type: LeaseAgreementResponseDto })
  async getLeaseAgreementById(
    @Param('id') leaseId: string,
  ): Promise<LeaseAgreementResponseDto> {
    return this.leaseAgreementsService.getLeaseAgreementById(leaseId);
  }

  @Get('application/:applicationId')
  @ApiOperation({ summary: 'Get lease agreement by application ID' })
  @ApiResponse({ status: 200, description: 'Lease agreement retrieved successfully', type: LeaseAgreementResponseDto })
  async getLeaseAgreementByApplication(
    @Param('applicationId') applicationId: string,
  ): Promise<LeaseAgreementResponseDto> {
    return this.leaseAgreementsService.getLeaseAgreementByApplication(applicationId);
  }
}
