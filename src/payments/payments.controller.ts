import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreatePaymentDto, PaymentResponseDto, StripePaymentIntentDto } from './dto/payment.dto.js';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate a payment for an application' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully', type: StripePaymentIntentDto })
  async initiatePayment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<StripePaymentIntentDto> {
    return this.paymentsService.initiatePayment(userId, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment (simulated Stripe webhook)' })
  @ApiResponse({ status: 200, description: 'Payment confirmed successfully', type: PaymentResponseDto })
  async confirmPayment(
    @Param('id') paymentId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.confirmPayment(paymentId);
  }

  @Get('application/:applicationId')
  @ApiOperation({ summary: 'Get all payments for an application' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully', type: [PaymentResponseDto] })
  async getPaymentsByApplication(
    @Param('applicationId') applicationId: string,
  ): Promise<PaymentResponseDto[]> {
    return this.paymentsService.getPaymentByApplication(applicationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully', type: PaymentResponseDto })
  async getPaymentById(
    @Param('id') paymentId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentById(paymentId);
  }

  @Post('booking-deposit')
  @ApiOperation({ summary: 'Initiate booking deposit payment for visit' })
  @ApiResponse({ status: 201, description: 'Booking deposit initiated successfully', type: StripePaymentIntentDto })
  async initiateBookingDeposit(
    @CurrentUser('id') userId: string,
    @Body() dto: { visitId: string; amount: number },
  ): Promise<StripePaymentIntentDto> {
    return this.paymentsService.initiateBookingDeposit(userId, dto.visitId, dto.amount);
  }
}
