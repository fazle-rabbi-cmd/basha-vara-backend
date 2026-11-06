import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'CREATE_PRODUCTION_ADMIN') {
  throw new Error('Set ADMIN_BOOTSTRAP_CONFIRM=CREATE_PRODUCTION_ADMIN to confirm this one-time operation.');
}
const databaseUrl = requiredEnv('DATABASE_URL');
const email = requiredEnv('ADMIN_BOOTSTRAP_EMAIL').trim().toLowerCase();
const password = requiredEnv('ADMIN_BOOTSTRAP_PASSWORD');
const fullName = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Basha Vara Administrator';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a valid email address.');
}
if (password.length < 14 || password.length > 128) {
  throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be between 14 and 128 characters.');
}

const databaseHost = new URL(databaseUrl).host;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log(`Bootstrapping admin account ${email} on database host ${databaseHost}.`);
  const passwordHash = bcrypt.hashSync(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!existing) {
      const admin = await tx.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          status: UserStatus.ACTIVE,
          roles: { create: [{ role: Role.ADMIN }] },
        },
      });
      return { userId: admin.id, action: 'created' as const };
    }

    if (existing.status !== UserStatus.ACTIVE) {
      throw new Error('Refusing to promote a non-active account. Activate it through the normal account recovery process first.');
    }

    const alreadyAdmin = existing.roles.some((userRole) => userRole.role === Role.ADMIN);
    await tx.userRole.upsert({
      where: { userId_role: { userId: existing.id, role: Role.ADMIN } },
      update: {},
      create: { userId: existing.id, role: Role.ADMIN },
    });

    if (!existing.passwordHash) {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    }

    return {
      userId: existing.id,
      action: alreadyAdmin ? 'already-admin' as const : 'promoted' as const,
    };
  });

  console.log(`Admin bootstrap ${result.action}; user ID ${result.userId}.`);
}

main()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });