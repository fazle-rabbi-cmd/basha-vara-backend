import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthEmailWorkerService } from './auth-email-worker.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }), PrismaModule],
  providers: [AuthEmailWorkerService],
})
export class AuthEmailWorkerModule {}