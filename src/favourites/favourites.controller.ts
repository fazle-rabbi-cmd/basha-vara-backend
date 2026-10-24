import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FavouritesService } from './favourites.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';

@ApiTags('Favourites')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('me/favourites')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Get()
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Get list of saved favourite properties for current tenant' })
  @ApiResponse({ status: 200, description: 'List of favourited properties' })
  async getMyFavourites(@CurrentUser('id') tenantId: string) {
    return this.favouritesService.getMyFavourites(tenantId);
  }

  @Post(':propertyId')
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Save a property to tenant favourites' })
  @ApiResponse({ status: 201, description: 'Property added to favourites' })
  @ApiResponse({ status: 409, description: 'Property is already in favourites' })
  async addFavourite(
    @CurrentUser('id') tenantId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.favouritesService.addFavourite(tenantId, propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TENANT, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a property from tenant favourites' })
  @ApiResponse({ status: 200, description: 'Property removed from favourites' })
  @ApiResponse({ status: 404, description: 'Favourite record not found' })
  async removeFavourite(
    @CurrentUser('id') tenantId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.favouritesService.removeFavourite(tenantId, propertyId);
  }
}
