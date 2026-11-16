import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { testUsers } from '../fixtures';

export class TestHelpers {
  static async createTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    return app;
  }

  static async getAuthToken(app: INestApplication, userType: 'tenant' | 'landlord' | 'admin' = 'tenant'): Promise<string> {
    const user = testUsers[userType];
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
      });

    if (response.status !== 200) {
      throw new Error(`Failed to get auth token for ${userType}: ${response.body.message}`);
    }

    return response.body.accessToken;
  }

  static async getPrismaService(app: INestApplication): Promise<PrismaService> {
    return app.get(PrismaService);
  }

  static async getJwtService(app: INestApplication): Promise<JwtService> {
    return app.get(JwtService);
  }

  static async cleanupTestData(prisma: PrismaService) {
    // Clean up test data in correct order
    await prisma.payment.deleteMany({});
    await prisma.escrow.deleteMany({});
    await prisma.leaseAgreement.deleteMany({});
    await prisma.rentalApplication.deleteMany({});
    await prisma.visitRequest.deleteMany({});
    await prisma.favourite.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.deviceToken.deleteMany({});
    await prisma.policeVerification.deleteMany({});
    await prisma.rentPayment.deleteMany({});
    await prisma.utilityCharge.deleteMany({});
    await prisma.propertyPhoto.deleteMany({});
    await prisma.propertyAmenity.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.tenantProfile.deleteMany({});
    await prisma.landlordProfile.deleteMany({});
    await prisma.userDocument.deleteMany({});
    await prisma.applicationProfile.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.authActionToken.deleteMany({});
    await prisma.user.deleteMany({});
  }

  static async seedTestData(prisma: PrismaService) {
    // This will be implemented with the test database setup
    // For now, return empty object
    return {};
  }

  static async waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  static generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static mockExternalServices() {
    // Mock email service
    // Mock push notification service
    // Mock file upload service
    // Mock external APIs
  }

  static restoreExternalServices() {
    // Restore original services
  }
}
