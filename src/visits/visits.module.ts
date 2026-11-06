import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service.js';
import {
  VisitsController,
  TenantVisitsController,
  LandlordVisitsController,
  PropertyVisitsController,
} from './visits.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    VisitsController,
    TenantVisitsController,
    LandlordVisitsController,
    PropertyVisitsController,
  ],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
