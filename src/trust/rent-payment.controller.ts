import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RentPaymentService } from './rent-payment.service.js';
import { CreateRentPaymentDto, AcknowledgePaymentDto, DisputePaymentDto, RentPaymentResponseDto } from './dto/rent-payment.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Rent Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('rent-payments')
export class RentPaymentController {
  constructor(private readonly rentPaymentService: RentPaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Record a rent payment (landlord only)' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully', type: RentPaymentResponseDto })
  async createPayment(
    @CurrentUser() user: any,
    @Body() dto: CreateRentPaymentDto,
  ): Promise<RentPaymentResponseDto> {
    return this.rentPaymentService.createRentPayment(user.id, dto);
  }

  @Post('acknowledge')
  @ApiOperation({ summary: 'Acknowledge a rent payment (tenant only)' })
  @ApiResponse({ status: 200, description: 'Payment acknowledged successfully', type: RentPaymentResponseDto })
  async acknowledgePayment(
    @CurrentUser() user: any,
    @Body() dto: AcknowledgePaymentDto,
  ): Promise<RentPaymentResponseDto> {
    return this.rentPaymentService.acknowledgePayment(user.id, dto);
  }

  @Post('dispute')
  @ApiOperation({ summary: 'Dispute a rent payment (tenant only)' })
  @ApiResponse({ status: 200, description: 'Payment disputed successfully', type: RentPaymentResponseDto })
  async disputePayment(
    @CurrentUser() user: any,
    @Body() dto: DisputePaymentDto,
  ): Promise<RentPaymentResponseDto> {
    return this.rentPaymentService.disputePayment(user.id, dto.paymentId, dto.reason);
  }

  @Get('lease/:leaseId')
  @ApiOperation({ summary: 'Get payments for a lease' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully', type: [RentPaymentResponseDto] })
  async getPaymentsForLease(
    @Param('leaseId') leaseId: string,
    @CurrentUser() user: any,
  ): Promise<RentPaymentResponseDto[]> {
    return this.rentPaymentService.getPaymentsForLease(leaseId, user.id, user.roles);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments for current user' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully', type: [RentPaymentResponseDto] })
  async getPayments(
    @CurrentUser() user: any,
  ): Promise<RentPaymentResponseDto[]> {
    return this.rentPaymentService.getPaymentsForUser(user.id, user.roles);
  }
}
