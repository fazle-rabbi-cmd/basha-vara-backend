import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.env.SUPER_ADMIN_BOOTSTRAP_CONFIRM !== 'CREATE_PRODUCTION_SUPER_ADMIN') {
  throw new Error('Set SUPER_ADMIN_BOOTSTRAP_CONFIRM=CREATE_PRODUCTION_SUPER_ADMIN to confirm this one-time operation.');
}
const databaseUrl = requiredEnv('DATABASE_URL');
const email = requiredEnv('SUPER_ADMIN_BOOTSTRAP_EMAIL').trim().toLowerCase();
const password = requiredEnv('SUPER_ADMIN_BOOTSTRAP_PASSWORD');
const fullName = process.env['SUPER_ADMIN_BOOTSTRAP_NAME']?.trim() || 'Basha Vara Super Administrator';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('SUPER_ADMIN_BOOTSTRAP_EMAIL must be a valid email address.');
}
if (password.length < 14 || password.length > 128) {
  throw new Error('SUPER_ADMIN_BOOTSTRAP_PASSWORD must be between 14 and 128 characters.');
}

const databaseHost = new URL(databaseUrl).host;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log(`Bootstrapping SUPER ADMIN account ${email} on database host ${databaseHost}.`);
  const passwordHash = bcrypt.hashSync(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    const superAdminRole = await tx.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found. Please run seed-roles.ts first.');
    }

    if (!existing) {
      const superAdmin = await tx.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          status: UserStatus.ACTIVE,
          roles: { create: [{ roleId: superAdminRole.id }] },
        },
      });
      return { userId: superAdmin.id, action: 'created' as const };
    }

    if (existing.status !== UserStatus.ACTIVE) {
      throw new Error('Refusing to promote a non-active account. Activate it through the normal account recovery process first.');
    }

    const alreadySuperAdmin = existing.roles.some((userRole) => userRole.roleId === superAdminRole.id);
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: existing.id, roleId: superAdminRole.id },
    });

    if (!existing.passwordHash) {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    }

    return {
      userId: existing.id,
      action: alreadySuperAdmin ? 'already-super-admin' as const : 'promoted' as const,
    };
  });

  console.log(`Super Admin bootstrap ${result.action}; user ID ${result.userId}.`);
}

main()
  .catch((error) => {
    console.error('Super Admin bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
