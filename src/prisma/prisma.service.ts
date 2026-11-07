import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export function buildPrismaDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);
  const usesPgBouncer = url.port === '6543' || url.hostname.includes('.pooler.');

  if (usesPgBouncer) {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connection_limit', '1');
  } else {
    url.searchParams.set('connection_limit', url.searchParams.get('connection_limit') ?? '5');
    url.searchParams.set('pool_timeout', url.searchParams.get('pool_timeout') ?? '10');
  }

  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = buildPrismaDatabaseUrl(process.env.DATABASE_URL);

    super({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL via Prisma');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }
}
