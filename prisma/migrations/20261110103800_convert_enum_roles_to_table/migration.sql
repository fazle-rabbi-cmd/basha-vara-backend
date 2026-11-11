-- Create roles table
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Create unique index on roles.name
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Insert default roles
INSERT INTO "roles" ("name", "displayName", "description", "isSystem") VALUES
('TENANT', 'Tenant', 'Regular tenant users who browse and apply for properties', true),
('LANDLORD', 'Landlord', 'Property owners who list and manage their properties', true),
('MODERATOR', 'Moderator', 'Content moderators who can manage property statuses', true),
('ADMIN', 'Admin', 'Administrators with full access to manage users and properties', true),
('SUPER_ADMIN', 'Super Admin', 'Super administrators with system-wide permissions including role management', true);

-- Add roleId column to role_permissions
ALTER TABLE "role_permissions" ADD COLUMN "roleId" UUID;

-- Migrate role_permissions data: map role enum to roleId
UPDATE "role_permissions" rp
SET "roleId" = r.id
FROM "roles" r
WHERE rp."role"::TEXT = r.name;

-- Make roleId NOT NULL after migration
ALTER TABLE "role_permissions" ALTER COLUMN "roleId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique constraint
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_role_permissionId_key";

-- Add new unique constraint on roleId, permissionId
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_permissionId_key" UNIQUE ("roleId", "permissionId");

-- Add index on roleId
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- Drop old role column
ALTER TABLE "role_permissions" DROP COLUMN "role";

-- Add roleId column to user_roles
ALTER TABLE "user_roles" ADD COLUMN "roleId" UUID;

-- Migrate user_roles data: map role enum to roleId
UPDATE "user_roles" ur
SET "roleId" = r.id
FROM "roles" r
WHERE ur."role"::TEXT = r.name;

-- Make roleId NOT NULL after migration
ALTER TABLE "user_roles" ALTER COLUMN "roleId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique constraint
ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_userId_role_key";

-- Add new unique constraint on userId, roleId
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_roleId_key" UNIQUE ("userId", "roleId");

-- Add index on roleId
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- Drop old role column
ALTER TABLE "user_roles" DROP COLUMN "role";

-- Drop the old Role enum type
DROP TYPE IF EXISTS "Role";
