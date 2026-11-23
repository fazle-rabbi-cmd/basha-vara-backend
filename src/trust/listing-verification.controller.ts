import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ListingVerificationService } from './listing-verification.service.js';
import { ListingVerificationDto, ReviewVerificationDto, ListingVerificationResponseDto } from './dto/listing-verification.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Listing Verification')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('listing-verification')
export class ListingVerificationController {
  constructor(private readonly listingVerificationService: ListingVerificationService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit listing verification documents' })
  @ApiResponse({ status: 201, description: 'Verification submitted successfully', type: ListingVerificationResponseDto })
  async submitVerification(
    @CurrentUser() user: any,
    @Body() dto: ListingVerificationDto,
  ): Promise<ListingVerificationResponseDto> {
    return this.listingVerificationService.submitVerification(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all listing verifications for current user' })
  @ApiResponse({ status: 200, description: 'Verifications retrieved successfully', type: [ListingVerificationResponseDto] })
  async getVerifications(
    @CurrentUser() user: any,
  ): Promise<ListingVerificationResponseDto[]> {
    return this.listingVerificationService.getVerifications(user.id, user.roles);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending verifications (admin only)' })
  @ApiResponse({ status: 200, description: 'Pending verifications retrieved successfully', type: [ListingVerificationResponseDto] })
  async getPendingVerifications(): Promise<ListingVerificationResponseDto[]> {
    return this.listingVerificationService.getPendingVerifications();
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review listing verification (admin only)' })
  @ApiResponse({ status: 200, description: 'Verification reviewed successfully', type: ListingVerificationResponseDto })
  async reviewVerification(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ReviewVerificationDto,
  ): Promise<ListingVerificationResponseDto> {
    return this.listingVerificationService.reviewVerification(id, user.id, dto.status, dto.rejectionReason);
  }
}
