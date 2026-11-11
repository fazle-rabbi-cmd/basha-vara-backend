import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AuthEmailWorkerModule } from './email/auth-email-worker.module.js';
import { NotificationEmailWorkerModule } from './email/notification-email-worker.module.js';

@Module({
  imports: [AuthEmailWorkerModule, NotificationEmailWorkerModule],
})
class CombinedEmailWorkerModule {}

const app = await NestFactory.createApplicationContext(CombinedEmailWorkerModule);
app.enableShutdownHooks();

// Keep the worker running
console.log('Email worker started (auth + notifications)');
