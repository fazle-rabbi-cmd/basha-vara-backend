import { Module } from '@nestjs/common';
import { FavouritesService } from './favourites.service.js';
import { FavouritesController } from './favourites.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [FavouritesController],
  providers: [FavouritesService],
  exports: [FavouritesService],
})
export class FavouritesModule {}
