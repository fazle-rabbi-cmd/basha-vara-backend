import { Module } from '@nestjs/common';
import { ListingVerificationService } from './listing-verification.service.js';
import { ReportService } from './report.service.js';
import { ReviewService } from './review.service.js';
import { RentPaymentService } from './rent-payment.service.js';
import { TrustScoreService } from './trust-score.service.js';
import { ListingVerificationController } from './listing-verification.controller.js';
import { ReportController } from './report.controller.js';
import { ReviewController } from './review.controller.js';
import { RentPaymentController } from './rent-payment.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [
    ListingVerificationService,
    ReportService,
    ReviewService,
    RentPaymentService,
    TrustScoreService,
  ],
  controllers: [
    ListingVerificationController,
    ReportController,
    ReviewController,
    RentPaymentController,
  ],
  exports: [
    ListingVerificationService,
    ReportService,
    ReviewService,
    RentPaymentService,
    TrustScoreService,
  ],
})
export class TrustModule {}
