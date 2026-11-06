import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service.js';
import {
  ApplicationsController,
  TenantApplicationsController,
  LandlordApplicationsController,
  PropertyApplicationsController,
} from './applications.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    ApplicationsController,
    TenantApplicationsController,
    LandlordApplicationsController,
    PropertyApplicationsController,
  ],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
