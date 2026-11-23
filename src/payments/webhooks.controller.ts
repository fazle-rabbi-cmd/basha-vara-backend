import { Controller, Post, Body, Headers, HttpCode, HttpStatus, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { PaymentProvider } from '../payments/providers/payment-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentStatus } from '@prisma/client';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @Inject('PAYMENT_PROVIDER') private paymentProvider: PaymentProvider,
    private prisma: PrismaService,
  ) {}

  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment provider webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handlePaymentWebhook(
    @Body() payload: any,
    @Headers('x-signature') signature: string,
  ) {
    // Verify webhook signature
    const isValid = this.paymentProvider.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process webhook idempotently
    const { event, transactionId, status, amount, timestamp } = payload;

    // Check if webhook was already processed
    const existingPayment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!existingPayment) {
      throw new BadRequestException('Payment not found for transaction ID');
    }

    // Update payment status based on webhook
    if (status === 'COMPLETED' && existingPayment.status === PaymentStatus.PENDING) {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(timestamp),
        },
      });
    } else if (status === 'FAILED' && existingPayment.status === PaymentStatus.PENDING) {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
    }

    return { received: true };
  }
}
