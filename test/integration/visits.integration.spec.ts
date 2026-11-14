import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

describe('Visits Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    
    // Add validation pipe to match production setup
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/me/visits', () => {
    it('should reject visits without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me/visits')
        .expect(401);
    });
  });

  describe('GET /api/v1/landlord/visits', () => {
    it('should reject landlord visits without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/landlord/visits')
        .expect(401);
    });
  });

  describe('POST /api/v1/properties/:propertyId/visits', () => {
    it('should reject visit creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/properties/test-property-id/visits')
        .send({
          scheduledAt: '2024-01-15T10:00:00Z',
          message: 'I would like to visit',
        })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/visits/:id/status', () => {
    it('should reject visit status update without auth', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/visits/test-visit-id/status')
        .send({
          status: 'CONFIRMED',
        })
        .expect(401);
    });
  });
});
