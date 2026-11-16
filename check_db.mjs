import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public'
    }
  }
});

async function checkDb() {
  try {
    const result = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
    console.log('Current DB:', result);
    
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log('Tables:', tables);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDb();
