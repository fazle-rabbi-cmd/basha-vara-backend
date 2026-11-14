import { PrismaClient } from '@prisma/client';

// Test with the exact URL from setup-e2e.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public'
    }
  }
});

async function debugTest() {
  try {
    // Check current database
    const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
    console.log('Connected to:', dbInfo);
    
    // Check if maritalStatus column exists
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenant_profiles' AND column_name = 'maritalStatus'
    `;
    console.log('maritalStatus column exists:', columnCheck.length > 0);
    
    // Try to create a user
    const user = await prisma.user.create({
      data: {
        email: 'debug@test.com',
        passwordHash: 'test_hash',
        fullName: 'Debug User',
        status: 'ACTIVE',
        tenantProfile: {
          create: {
            occupation: 'Engineer',
            maritalStatus: 'SINGLE',
            householdSize: 1,
          }
        }
      },
      include: {
        tenantProfile: true
      }
    });
    console.log('User created successfully:', user.id);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

debugTest();
