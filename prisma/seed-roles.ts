import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  {
    name: 'TENANT',
    displayName: 'Tenant',
    description: 'Regular tenant users who browse and apply for properties',
    isSystem: true,
  },
  {
    name: 'LANDLORD',
    displayName: 'Landlord',
    description: 'Property owners who list and manage their properties',
    isSystem: true,
  },
  {
    name: 'MODERATOR',
    displayName: 'Moderator',
    description: 'Content moderators who can manage property statuses',
    isSystem: true,
  },
  {
    name: 'ADMIN',
    displayName: 'Admin',
    description: 'Administrators with full access to manage users and properties',
    isSystem: true,
  },
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Super administrators with system-wide permissions including role management',
    isSystem: true,
  },
];

async function seedRoles() {
  console.log('Starting role seeding...');

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log(`Created ${roles.length} roles`);
  console.log('Role seeding completed successfully');
}

seedRoles()
  .catch((e) => {
    console.error('Error seeding roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
