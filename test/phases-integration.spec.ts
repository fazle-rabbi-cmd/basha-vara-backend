import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';

describe('Phase 2, 3, 4 Integration Tests', () => {
  let app: INestApplication;
  let tenantToken: string;
  let landlordToken: string;
  let testPropertyId: string;
  let testVisitId: string;
  let testApplicationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Phase 2: Authentication & User Profiles', () => {
    it('POST /api/v1/auth/login (Landlord)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'landlord1@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('landlord1@example.com');
      expect(res.body.user.roles).toContain('LANDLORD');
      landlordToken = res.body.accessToken;
    });

    it('POST /api/v1/auth/login (Tenant)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'tenant1@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('tenant1@example.com');
      expect(res.body.user.roles).toContain('TENANT');
      tenantToken = res.body.accessToken;
    });

    it('GET /api/v1/auth/me (Authenticated Tenant)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('tenant1@example.com');
      expect(res.body.tenantProfile).toBeDefined();
    });

    it('PATCH /api/v1/users/me/tenant-profile', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/tenant-profile')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          occupation: 'Principal Software Architect',
          householdSize: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.occupation).toBe('Principal Software Architect');
      expect(res.body.householdSize).toBe(3);
    });
  });

  describe('Phase 3: Properties Domain', () => {
    it('GET /api/v1/amenities', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/amenities');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/properties (Public Catalog)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .query({ city: 'Dhaka', limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      testPropertyId = res.body.data[0].id;
    });

    it('GET /api/v1/properties/:id (Details)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/properties/${testPropertyId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testPropertyId);
      expect(res.body.title).toBeDefined();
      expect(res.body.landlord).toBeDefined();
    });

    it('POST /api/v1/properties (Landlord creates property)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          title: 'Automated Test Luxury Suite in Gulshan 2',
          description: 'Spacious high-end apartment for verified tenants.',
          propertyType: 'APARTMENT',
          rentAmount: 60000,
          depositAmount: 120000,
          bedrooms: 3,
          bathrooms: 3,
          areaSqft: 2100,
          floor: 5,
          totalFloors: 12,
          addressLine: 'Road 55, Gulshan 2',
          area: 'Gulshan',
          city: 'Dhaka',
          district: 'Dhaka',
          availableFrom: '2026-12-01T00:00:00.000Z',
          status: 'PUBLISHED',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Automated Test Luxury Suite in Gulshan 2');
    });
  });

  describe('Phase 4: Favourites, Visits & Rental Applications', () => {
    it('POST /api/v1/me/favourites/:propertyId', async () => {
      // Clean up previous favourite if exists
      await request(app.getHttpServer())
        .delete(`/api/v1/me/favourites/${testPropertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/me/favourites/${testPropertyId}`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Property added to favourites');
    });

    it('GET /api/v1/me/favourites (Tenant list)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/favourites')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((f: any) => f.property.id === testPropertyId)).toBe(true);
    });

    it('POST /api/v1/properties/:propertyId/visits (Schedule Visit)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/properties/${testPropertyId}/visits`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          requestedDate: '2026-11-20T00:00:00.000Z',
          requestedTime: '11:00 AM',
          message: 'Interested in a weekend viewing',
        });

      // Status 201 or 400 if already pending
      if (res.status === 201) {
        expect(res.body.status).toBe('PENDING');
        testVisitId = res.body.id;
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('GET /api/v1/me/visits (Tenant views visits)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/visits')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0 && !testVisitId) {
        testVisitId = res.body[0].id;
      }
    });

    it('PATCH /api/v1/visits/:id/status (Landlord accepts visit)', async () => {
      if (testVisitId) {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/visits/${testVisitId}/status`)
          .set('Authorization', `Bearer ${landlordToken}`)
          .send({ status: 'ACCEPTED' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ACCEPTED');
      }
    });

    it('POST /api/v1/properties/:propertyId/applications (Submit Rental Application)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/properties/${testPropertyId}/applications`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          coverNote: 'Looking forward to moving in with my family.',
          moveInDate: '2026-12-01T00:00:00.000Z',
          proposedRent: 35000,
        });

      if (res.status === 201) {
        expect(res.body.status).toBe('SUBMITTED');
        testApplicationId = res.body.id;
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('GET /api/v1/landlord/applications (Landlord views applications)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/landlord/applications')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0 && !testApplicationId) {
        testApplicationId = res.body[0].id;
      }
    });

    it('PATCH /api/v1/applications/:id/status (Landlord shortlists application)', async () => {
      if (testApplicationId) {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/applications/${testApplicationId}/status`)
          .set('Authorization', `Bearer ${landlordToken}`)
          .send({ status: 'SHORTLISTED' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('SHORTLISTED');
      }
    });
  });
});
