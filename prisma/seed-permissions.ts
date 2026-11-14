import { PrismaClient, SystemPermission } from '@prisma/client';

const prisma = new PrismaClient();

const rolePermissions: Record<string, SystemPermission[]> = {
  TENANT: [
    SystemPermission.PROPERTY_READ_ANY,
    SystemPermission.VISIT_CREATE,
    SystemPermission.VISIT_READ_OWN,
    SystemPermission.VISIT_UPDATE_OWN,
    SystemPermission.VISIT_DELETE_OWN,
    SystemPermission.APPLICATION_CREATE,
    SystemPermission.APPLICATION_READ_OWN,
    SystemPermission.APPLICATION_UPDATE_OWN,
    SystemPermission.APPLICATION_DELETE_OWN,
    SystemPermission.USER_READ_OWN,
    SystemPermission.USER_READ_CONTACT,
    SystemPermission.USER_UPDATE_OWN,
  ],
  LANDLORD: [
    SystemPermission.PROPERTY_CREATE,
    SystemPermission.PROPERTY_READ_OWN,
    SystemPermission.PROPERTY_UPDATE_OWN,
    SystemPermission.PROPERTY_DELETE_OWN,
    SystemPermission.PROPERTY_CHANGE_STATUS_OWN,
    SystemPermission.VISIT_READ_ANY,
    SystemPermission.VISIT_UPDATE_ANY,
    SystemPermission.APPLICATION_READ_ANY,
    SystemPermission.APPLICATION_STATUS_UPDATE_OWN,
    SystemPermission.USER_READ_ANY,
    SystemPermission.USER_READ_CONTACT,
    SystemPermission.USER_READ_OWN,
    SystemPermission.USER_UPDATE_OWN,
  ],
  MODERATOR: [
    SystemPermission.PROPERTY_READ_ANY,
    SystemPermission.PROPERTY_CHANGE_STATUS_ANY,
    SystemPermission.PROPERTY_UPDATE_ANY,
    SystemPermission.VISIT_READ_ANY,
    SystemPermission.VISIT_UPDATE_ANY,
    SystemPermission.APPLICATION_READ_ANY,
    SystemPermission.APPLICATION_STATUS_UPDATE_ANY,
    SystemPermission.USER_READ_ANY,
    SystemPermission.ADMIN_VIEW_METRICS,
  ],
  ADMIN: Object.values(SystemPermission),
  SUPER_ADMIN: [...Object.values(SystemPermission), SystemPermission.USER_ASSIGN_ROLE, SystemPermission.ADMIN_MANAGE_ROLES],
};

async function seedPermissions() {
  console.log('Starting permission seeding...');

  const allPermissions = Object.values(SystemPermission);
  for (const perm of allPermissions) {
    const permString = perm as string;
    await prisma.permission.upsert({
      where: { name: permString },
      update: {},
      create: {
        name: permString,
        description: permString.replace(/_/g, ' ').toLowerCase(),
        category: permString.split('_')[0].toLowerCase(),
      },
    });
  }
  console.log(`Created ${allPermissions.length} permissions`);

  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    console.log(`Assigning ${permissions.length} permissions to role: ${roleName}`);

    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      console.error(`Role not found: ${roleName}`);
      continue;
    }

    for (const perm of permissions) {
      const permString = perm as string;
      const permission = await prisma.permission.findUnique({
        where: { name: permString },
      });

      if (!permission) {
        console.error(`Permission not found: ${permString}`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Permission seeding completed successfully');
}

seedPermissions()
  .catch((e) => {
    console.error('Error seeding permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
