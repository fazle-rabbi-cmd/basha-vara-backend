import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public'
    }
  }
});

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    console.log('Users columns:', result);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
