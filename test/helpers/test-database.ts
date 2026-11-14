import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public'
    }
  }
});

export class TestDatabase {
  static async setup() {
    // Clean up existing test data
    await this.cleanup();

    // Seed minimal test data
    await this.seedMinimal();
  }

  static async cleanup() {
    // Delete in correct order to respect foreign key constraints
    const tables = [
      'payments', 'escrows', 'lease_agreements', 'rental_applications',
      'visit_requests', 'favourites', 'notifications', 'device_tokens',
      'police_verifications', 'rent_payments', 'utility_charges',
      'property_photos', 'property_amenities', 'properties',
      'tenant_profiles', 'landlord_profiles', 'user_documents',
      'application_profiles', 'user_roles', 'auth_action_tokens', 'users'
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      } catch (error) {
        // Ignore errors for missing tables
        console.warn(`Failed to cleanup ${table}:`, error.message);
      }
    }

    // Also delete any remaining test users
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@example.com'`);
    } catch (error) {
      console.warn('Failed to cleanup test users:', error.message);
    }
  }

  static async seedMinimal() {
    // Create a single test user for basic tests with upsert
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        passwordHash: '$2a$10$test_hash',
        fullName: 'Test User',
        phone: '01712345678',
        status: 'ACTIVE',
        roles: {
          create: [{
            role: {
              connectOrCreate: {
                where: { name: 'TENANT' },
                create: {
                  name: 'TENANT',
                  displayName: 'Tenant',
                  description: 'Tenant role',
                  isSystem: true,
                },
              },
            },
          }],
        },
        tenantProfile: {
          create: {
            occupation: 'Software Engineer',
            maritalStatus: 'SINGLE',
            householdSize: 1,
            hasChildren: false,
            hasPets: false,
            smokingStatus: 'NON_SMOKER',
            returnTimePreference: '23:00',
            gender: 'MALE',
          },
        },
      },
      include: {
        roles: true,
        tenantProfile: true,
      },
    });

    return { testUser };
  }

  static async seed() {
    // Create test users with upsert to handle existing records
    const tenant = await prisma.user.upsert({
      where: { email: 'tenant@test.com' },
      update: {},
      create: {
        id: 'test-tenant-id',
        email: 'tenant@test.com',
        passwordHash: '$2a$10$test_hash',
        fullName: 'Test Tenant',
        phone: '01712345678',
        status: 'ACTIVE',
        roles: {
          create: [{
            role: {
              connectOrCreate: {
                where: { name: 'TENANT' },
                create: {
                  name: 'TENANT',
                  displayName: 'Tenant',
                  description: 'Tenant role',
                  isSystem: true,
                },
              },
            },
          }],
        },
        tenantProfile: {
          create: {
            occupation: 'Software Engineer',
            maritalStatus: 'SINGLE',
            householdSize: 1,
            hasChildren: false,
            hasPets: false,
            smokingStatus: 'NON_SMOKER',
            returnTimePreference: '23:00',
            gender: 'MALE',
          },
        },
      },
    });

    const landlord = await prisma.user.upsert({
      where: { email: 'landlord@test.com' },
      update: {},
      create: {
        id: 'test-landlord-id',
        email: 'landlord@test.com',
        passwordHash: '$2a$10$test_hash',
        fullName: 'Test Landlord',
        phone: '01712345679',
        status: 'ACTIVE',
        roles: {
          create: [{
            role: {
              connectOrCreate: {
                where: { name: 'LANDLORD' },
                create: {
                  name: 'LANDLORD',
                  displayName: 'Landlord',
                  description: 'Landlord role',
                  isSystem: true,
                },
              },
            },
          }],
        },
        landlordProfile: {
          create: {
            businessName: 'Test Property Management',
            contactPreference: 'EMAIL',
          },
        },
      },
    });

    return {
      tenant,
      landlord,
    };
  }

  static async disconnect() {
    await prisma.$disconnect();
  }
}
