import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

describe('Properties Integration Tests', () => {
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

  describe('GET /api/v1/properties', () => {
    it('should return paginated properties', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter properties by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties?propertyType=APARTMENT')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter properties by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/properties?minRent=20000&maxRent=30000')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/properties/:id', () => {
    it('should return 404 for non-existent property', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/properties/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('POST /api/v1/properties', () => {
    it('should reject property creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/properties')
        .send({
          title: 'New Property',
          description: 'New property description',
          propertyType: 'APARTMENT',
          rentAmount: 30000,
          depositAmount: 60000,
          bedrooms: 3,
          bathrooms: 2,
          areaSqft: 1500,
          floor: 5,
          totalFloors: 10,
          addressLine: '456 New St',
          area: 'Gulshan',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: '2024-02-01',
          lat: 23.7808,
          lng: 90.4074,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/properties/compatible', () => {
    it('should reject compatible properties without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/properties/compatible')
        .expect(401);
    });
  });
});
