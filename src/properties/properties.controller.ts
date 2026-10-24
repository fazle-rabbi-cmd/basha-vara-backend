import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PropertiesService } from './properties.service.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PropertyStatus, Role } from '@prisma/client';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter public rental properties' })
  @ApiResponse({ status: 200, description: 'Paginated list of properties matching filter criteria' })
  async getProperties(@Query() query: PropertyQueryDto) {
    return this.propertiesService.findAll(query);
  }

  @Get('landlord/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all properties managed by authenticated landlord' })
  @ApiQuery({ name: 'status', enum: PropertyStatus, required: false })
  @ApiResponse({ status: 200, description: 'Landlord property portfolio with engagement stats' })
  async getMyProperties(
    @CurrentUser('id') landlordId: string,
    @Query('status') status?: PropertyStatus,
  ) {
    return this.propertiesService.findLandlordProperties(landlordId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed property listing by ID' })
  @ApiResponse({ status: 200, description: 'Property details with amenities, photos, and landlord info' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getPropertyById(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    // Check if optional user token is present to calculate isFavourited
    const user = (req as any).user as AuthenticatedUser | undefined;
    return this.propertiesService.findById(id, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new property listing (Landlords and Admins)' })
  @ApiResponse({ status: 201, description: 'Property successfully created' })
  async createProperty(
    @CurrentUser('id') landlordId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(landlordId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an existing property listing' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if not the property landlord owner' })
  async updateProperty(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, user.id, user.roles, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Publish a draft or paused property listing' })
  @ApiResponse({ status: 200, description: 'Property status changed to PUBLISHED' })
  async publishProperty(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.changeStatus(id, user.id, user.roles, PropertyStatus.PUBLISHED);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Pause a published property listing' })
  @ApiResponse({ status: 200, description: 'Property status changed to PAUSED' })
  async pauseProperty(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.changeStatus(id, user.id, user.roles, PropertyStatus.PAUSED);
  }

  @Post(':id/mark-rented')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark property listing as rented out' })
  @ApiResponse({ status: 200, description: 'Property status changed to RENTED' })
  async markRented(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.changeStatus(id, user.id, user.roles, PropertyStatus.RENTED);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Archive or remove a property listing' })
  @ApiResponse({ status: 200, description: 'Property archived or deleted successfully' })
  async deleteProperty(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.deleteProperty(id, user.id, user.roles);
  }
}
