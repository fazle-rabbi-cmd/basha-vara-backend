import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, WebhookPayload } from './payment-provider.interface.js';
import * as crypto from 'crypto';

@Injectable()
export class SandboxPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(SandboxPaymentProvider.name);
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'sandbox-secret-key';
    this.logger.log('Sandbox Payment Provider initialized (sandbox mode)');
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = `sandbox_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.logger.log(`Initiating sandbox payment: ${transactionId}, amount: ${request.amount} ${request.currency}`);

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Always succeed in sandbox mode
    return {
      success: true,
      transactionId,
      status: 'COMPLETED',
      message: 'Sandbox payment completed successfully',
    };
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    const refundId = `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.logger.log(`Processing sandbox refund: ${refundId}, transaction: ${request.transactionId}, amount: ${request.amount}`);

    // Simulate refund processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      refundId,
      status: 'COMPLETED',
      message: 'Sandbox refund completed successfully',
    };
  }

  verifyWebhookSignature(payload: WebhookPayload, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    this.logger.log(`Getting sandbox payment status for: ${transactionId}`);

    // In sandbox mode, always return completed
    return {
      success: true,
      transactionId,
      status: 'COMPLETED',
      message: 'Sandbox payment status retrieved',
    };
  }
}
