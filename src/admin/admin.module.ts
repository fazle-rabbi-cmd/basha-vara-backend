import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController, PublicController } from './admin.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, PublicController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
