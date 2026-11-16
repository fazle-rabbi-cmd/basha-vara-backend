import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public'
    }
  }
});

async function testPrisma() {
  try {
    // Try to create a user with maritalStatus
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'test_hash',
        fullName: 'Test User',
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
    console.log('User created:', user);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
