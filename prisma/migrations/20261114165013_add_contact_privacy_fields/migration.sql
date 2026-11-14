-- CreateEnum
CREATE TYPE "ContactVisibility" AS ENUM ('PLATFORM_ONLY', 'MASKED', 'FULL');

-- CreateEnum
CREATE TYPE "ContactMilestone" AS ENUM ('NEVER', 'VISIT_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPLICATION_SHORTLISTED', 'APPLICATION_ACCEPTED', 'PAYMENT_INITIATED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTACT_REVEALED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemPermission" ADD VALUE 'USER_READ_CONTACT';
ALTER TYPE "SystemPermission" ADD VALUE 'USER_REVEAL_CONTACT';

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_applicationId_fkey";

-- DropIndex
DROP INDEX "amenities_name_key";

-- DropIndex
DROP INDEX "notifications_createdAt_idx";

-- DropIndex
DROP INDEX "rental_applications_verifiedVisitId_idx";

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "applicationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVisibility" "ContactVisibility" NOT NULL DEFAULT 'MASKED',
ADD COLUMN     "phoneVisibility" "ContactVisibility" NOT NULL DEFAULT 'MASKED',
ADD COLUMN     "revealContactAfterMilestone" "ContactMilestone" NOT NULL DEFAULT 'APPLICATION_SHORTLISTED';

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "propertyId" UUID,
    "content" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "messages_propertyId_idx" ON "messages"("propertyId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "lease_agreements_applicationId_idx" ON "lease_agreements"("applicationId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "properties_createdAt_idx" ON "properties"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "properties_status_createdAt_idx" ON "properties"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "properties_landlordId_status_idx" ON "properties"("landlordId", "status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "rental_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
