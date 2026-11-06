import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Service & Database Health Status' })
  @ApiResponse({ status: 200, description: 'Application and database are fully operational' })
  @ApiResponse({ status: 503, description: 'Database connection failed' })
  async check() {
    const startTime = Date.now();
    try {
      // Direct raw query to verify actual PostgreSQL connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Date.now() - startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'up',
          latencyMs: dbLatencyMs,
          engine: 'PostgreSQL 17',
        },
      };
    } catch (error: any) {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          status: 'down',
          message: error.message,
        },
      });
    }
  }
}
