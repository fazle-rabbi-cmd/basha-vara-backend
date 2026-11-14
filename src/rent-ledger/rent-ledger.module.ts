import { Module } from '@nestjs/common';
import { RentLedgerService } from './rent-ledger.service.js';
import { RentLedgerController } from './rent-ledger.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [RentLedgerService],
  controllers: [RentLedgerController],
  exports: [RentLedgerService],
})
export class RentLedgerModule {}
