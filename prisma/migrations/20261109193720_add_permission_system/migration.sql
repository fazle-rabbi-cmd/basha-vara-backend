-- CreateEnum
CREATE TYPE "SystemPermission" AS ENUM ('PROPERTY_CREATE', 'PROPERTY_READ_OWN', 'PROPERTY_READ_ANY', 'PROPERTY_UPDATE_OWN', 'PROPERTY_UPDATE_ANY', 'PROPERTY_DELETE_OWN', 'PROPERTY_DELETE_ANY', 'PROPERTY_CHANGE_STATUS_OWN', 'PROPERTY_CHANGE_STATUS_ANY', 'VISIT_CREATE', 'VISIT_READ_OWN', 'VISIT_READ_ANY', 'VISIT_UPDATE_OWN', 'VISIT_UPDATE_ANY', 'VISIT_DELETE_OWN', 'VISIT_DELETE_ANY', 'APPLICATION_CREATE', 'APPLICATION_READ_OWN', 'APPLICATION_READ_ANY', 'APPLICATION_UPDATE_OWN', 'APPLICATION_UPDATE_ANY', 'APPLICATION_DELETE_OWN', 'APPLICATION_DELETE_ANY', 'APPLICATION_STATUS_UPDATE_OWN', 'APPLICATION_STATUS_UPDATE_ANY', 'USER_READ_OWN', 'USER_READ_ANY', 'USER_UPDATE_OWN', 'USER_UPDATE_ANY', 'USER_DELETE_OWN', 'USER_DELETE_ANY', 'USER_ASSIGN_ROLE', 'ADMIN_VIEW_METRICS', 'ADMIN_MODERATE_PROPERTIES', 'ADMIN_MODERATE_USERS', 'ADMIN_MANAGE_ROLES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MODERATOR';
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permissionId_key" ON "role_permissions"("role", "permissionId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
