import { Module } from '@nestjs/common';
import { LeaseAgreementsService } from './lease-agreements.service.js';
import { LeaseAgreementsController } from './lease-agreements.controller.js';

@Module({
  providers: [LeaseAgreementsService],
  controllers: [LeaseAgreementsController],
  exports: [LeaseAgreementsService],
})
export class LeaseAgreementsModule {}
