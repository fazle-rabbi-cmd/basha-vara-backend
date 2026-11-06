import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PropertiesService } from './properties.service.js';

@ApiTags('Amenities')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available amenities and features for property filtering' })
  @ApiResponse({ status: 200, description: 'List of platform amenities grouped by category' })
  async getAmenities() {
    return this.propertiesService.getAmenities();
  }
}
