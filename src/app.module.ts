import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
