import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { PgBossService } from '../pg-boss/pg-boss.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pgBoss: PgBossService,
  ) {}

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

      // Check pg-boss status
      let pgBossStatus = 'unknown';
      try {
        await this.pgBoss.getBoss();
        pgBossStatus = 'up';
      } catch (error) {
        pgBossStatus = 'down';
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: 'up',
          latencyMs: dbLatencyMs,
          engine: 'PostgreSQL 17',
        },
        jobQueue: {
          status: pgBossStatus,
          engine: 'pg-boss',
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
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

  @Get('ready')
  @ApiOperation({ summary: 'Readiness Probe' })
  @ApiResponse({ status: 200, description: 'Application is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.pgBoss.getBoss();

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        message: 'Application dependencies are not available',
      });
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness Probe' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
