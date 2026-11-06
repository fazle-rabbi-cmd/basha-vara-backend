import { NestFactory } from '@nestjs/core';
import { AuthEmailWorkerModule } from './email/auth-email-worker.module.js';

const app = await NestFactory.createApplicationContext(AuthEmailWorkerModule);
app.enableShutdownHooks();