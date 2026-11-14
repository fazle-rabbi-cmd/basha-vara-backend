import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PoliceVerificationService } from './police-verification.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GeneratePoliceVerificationDto, PoliceVerificationResponseDto } from './dto/police-verification.dto.js';

@ApiTags('Police Verification')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('police-verification')
export class PoliceVerificationController {
  constructor(private readonly policeVerificationService: PoliceVerificationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate police verification form for tenant' })
  @ApiResponse({ status: 201, description: 'Police verification generated successfully', type: PoliceVerificationResponseDto })
  async generatePoliceVerification(
    @CurrentUser() user: any,
    @Body() dto: GeneratePoliceVerificationDto,
  ): Promise<PoliceVerificationResponseDto> {
    return this.policeVerificationService.generatePoliceVerification(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all police verifications for current user' })
  @ApiResponse({ status: 200, description: 'Police verifications retrieved successfully', type: [PoliceVerificationResponseDto] })
  async getPoliceVerifications(
    @CurrentUser() user: any,
  ): Promise<PoliceVerificationResponseDto[]> {
    return this.policeVerificationService.getPoliceVerifications(user.id, user.roles);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download police verification PDF' })
  @ApiResponse({ status: 200, description: 'PDF downloaded successfully' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.policeVerificationService.generatePdf(id, user.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="police-verification-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit police verification form' })
  @ApiResponse({ status: 200, description: 'Police verification submitted successfully', type: PoliceVerificationResponseDto })
  async submitVerification(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PoliceVerificationResponseDto> {
    return this.policeVerificationService.submitVerification(id, user.id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify police verification (admin only)' })
  @ApiResponse({ status: 200, description: 'Police verification verified successfully', type: PoliceVerificationResponseDto })
  async verifyPoliceVerification(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<PoliceVerificationResponseDto> {
    return this.policeVerificationService.verifyPoliceVerification(id, user.id);
  }
}
