import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { WebhooksController } from './webhooks.controller.js';
import { LedgerService } from './ledger.service.js';
import { SandboxPaymentProvider } from './providers/sandbox-payment.provider.js';
import { PaymentProvider } from './providers/payment-provider.interface.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [
    PaymentsService,
    LedgerService,
    SandboxPaymentProvider,
    {
      provide: 'PAYMENT_PROVIDER',
      useClass: SandboxPaymentProvider,
    },
  ],
  controllers: [PaymentsController, WebhooksController],
  exports: [PaymentsService, LedgerService, 'PAYMENT_PROVIDER'],
})
export class PaymentsModule {}
