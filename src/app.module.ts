import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { CommonModule } from './common/common.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { FavouritesModule } from './favourites/favourites.module.js';
import { VisitsModule } from './visits/visits.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AdminModule } from './admin/admin.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { NotificationEmailQueueModule } from './email/notification-email-queue.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { LeaseAgreementsModule } from './lease-agreements/lease-agreements.module.js';
import { EscrowModule } from './escrow/escrow.module.js';
import { PoliceVerificationModule } from './police-verification/police-verification.module.js';
import { RentLedgerModule } from './rent-ledger/rent-ledger.module.js';
import { PushNotificationsModule } from './push-notifications/push-notifications.module.js';
import { WebSocketsModule } from './websockets/websockets.module.js';
import { PgBossModule } from './pg-boss/pg-boss.module.js';
import { JobFailureMonitorService } from './pg-boss/job-failure-monitor.service.js';
import { TrustModule } from './trust/trust.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { SecurityModule } from './security/security.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    FavouritesModule,
    VisitsModule,
    ApplicationsModule,
    AdminModule,
    UploadsModule,
    NotificationsModule,
    NotificationEmailQueueModule,
    MessagesModule,
    PaymentsModule,
    LeaseAgreementsModule,
    EscrowModule,
    PoliceVerificationModule,
    RentLedgerModule,
    PushNotificationsModule,
    WebSocketsModule,
    PgBossModule,
    TrustModule,
    ObservabilityModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService, JobFailureMonitorService],
})
export class AppModule {}
