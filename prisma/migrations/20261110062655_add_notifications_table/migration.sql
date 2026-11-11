-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VISIT_REQUESTED', 'VISIT_ACCEPTED', 'VISIT_DECLINED', 'VISIT_CANCELLED', 'VISIT_COMPLETED', 'APPLICATION_SUBMITTED', 'APPLICATION_UNDER_REVIEW', 'APPLICATION_SHORTLISTED', 'APPLICATION_REJECTED', 'APPLICATION_SELECTED', 'APPLICATION_WITHDRAWN', 'PROPERTY_PUBLISHED', 'PROPERTY_RENTED', 'PROPERTY_PAUSED', 'SYSTEM');

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
