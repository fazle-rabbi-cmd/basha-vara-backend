export interface PaymentRequest {
  amount: number;
  currency: string;
  paymentType: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  message?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  message?: string;
}

export interface WebhookPayload {
  event: string;
  transactionId: string;
  status: string;
  amount: number;
  timestamp: string;
  signature: string;
}

export interface PaymentProvider {
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;
  processRefund(request: RefundRequest): Promise<RefundResponse>;
  verifyWebhookSignature(payload: WebhookPayload, signature: string): boolean;
  getPaymentStatus(transactionId: string): Promise<PaymentResponse>;
}
