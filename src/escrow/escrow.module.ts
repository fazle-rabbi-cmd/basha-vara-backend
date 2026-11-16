import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service.js';
import { EscrowController } from './escrow.controller.js';

@Module({
  providers: [EscrowService],
  controllers: [EscrowController],
  exports: [EscrowService],
})
export class EscrowModule {}
