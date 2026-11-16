import { Module } from '@nestjs/common';
import { PoliceVerificationService } from './police-verification.service.js';
import { PoliceVerificationController } from './police-verification.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [PoliceVerificationService],
  controllers: [PoliceVerificationController],
  exports: [PoliceVerificationService],
})
export class PoliceVerificationModule {}
