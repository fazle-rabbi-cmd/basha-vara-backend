import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should report database as up when query succeeds', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.database.engine).toBe('PostgreSQL 17');
    expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('should throw ServiceUnavailableException when database query fails', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection lost'));
    await expect(controller.check()).rejects.toThrow();
  });
});
