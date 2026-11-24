-- CreateEnum
CREATE TYPE "VerificationBadgeType" AS ENUM ('IN_PERSON_VERIFIED', 'VIDEO_VERIFIED');

-- CreateEnum
CREATE TYPE "ListingVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'WAITLISTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ESCROW_PENDING';
ALTER TYPE "ApplicationStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EscrowStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "EscrowStatus" ADD VALUE 'RELEASE_REQUESTED';
ALTER TYPE "EscrowStatus" ADD VALUE 'REFUND_REQUESTED';
ALTER TYPE "EscrowStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "EscrowStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "EscrowStatus" ADD VALUE 'FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LISTING_VERIFICATION_DUPLICATE';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_VERIFICATION_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'RENT_PAYMENT_RECORDED';
ALTER TYPE "NotificationType" ADD VALUE 'RENT_PAYMENT_ACKNOWLEDGED';
ALTER TYPE "NotificationType" ADD VALUE 'RENT_PAYMENT_DISPUTED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_REVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "VisitStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "VisitStatus" ADD VALUE 'RESCHEDULE_PROPOSED';
ALTER TYPE "VisitStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "VisitStatus" ADD VALUE 'NO_SHOW';
ALTER TYPE "VisitStatus" ADD VALUE 'LANDLORD_NO_SHOW';

-- AlterTable
ALTER TABLE "landlord_profiles" ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "rent_payments" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedBy" UUID,
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "leaseId" UUID;

-- AlterTable
ALTER TABLE "rental_applications" ADD COLUMN     "paymentDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_profiles" ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "religion" TEXT;

-- AlterTable
ALTER TABLE "visit_requests" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" UUID,
ADD COLUMN     "checkInMetadata" JSONB,
ADD COLUMN     "confirmedSlot" JSONB,
ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "declineReasonCode" TEXT,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "landlordAttendanceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "landlordAttended" BOOLEAN,
ADD COLUMN     "landlordConfirmedCallAt" TIMESTAMP(3),
ADD COLUMN     "landlordNoShowReportedAt" TIMESTAMP(3),
ADD COLUMN     "landlordNoShowReportedBy" UUID,
ADD COLUMN     "landlordOtpHashed" TEXT,
ADD COLUMN     "noShowReportedAt" TIMESTAMP(3),
ADD COLUMN     "noShowReportedBy" UUID,
ADD COLUMN     "otpSalt" TEXT,
ADD COLUMN     "proposedSlots" JSONB,
ADD COLUMN     "rescheduleSlot" JSONB,
ADD COLUMN     "tenantConfirmedCallAt" TIMESTAMP(3),
ADD COLUMN     "tenantOtpHashed" TEXT,
ADD COLUMN     "verificationBadge" "VerificationBadgeType",
ADD COLUMN     "verificationFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationLockedAt" TIMESTAMP(3),
ADD COLUMN     "verificationLockedReason" TEXT,
ADD COLUMN     "verifiedVisitorExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "property_availability_windows" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "accountType" TEXT NOT NULL,
    "userId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "paymentId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "entryType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_verifications" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentHash" TEXT,
    "status" "ListingVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "revieweeId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "leaseId" UUID,
    "visitId" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_score_history" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" TEXT NOT NULL,
    "oldScore" INTEGER NOT NULL,
    "newScore" INTEGER NOT NULL,
    "changeReason" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_logs" (
    "id" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accessType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_availability_windows_propertyId_idx" ON "property_availability_windows"("propertyId");

-- CreateIndex
CREATE INDEX "ledger_accounts_accountType_idx" ON "ledger_accounts"("accountType");

-- CreateIndex
CREATE INDEX "ledger_accounts_userId_idx" ON "ledger_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_accountType_userId_key" ON "ledger_accounts"("accountType", "userId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_idx" ON "ledger_entries"("accountId");

-- CreateIndex
CREATE INDEX "ledger_entries_paymentId_idx" ON "ledger_entries"("paymentId");

-- CreateIndex
CREATE INDEX "ledger_entries_createdAt_idx" ON "ledger_entries"("createdAt");

-- CreateIndex
CREATE INDEX "listing_verifications_propertyId_idx" ON "listing_verifications"("propertyId");

-- CreateIndex
CREATE INDEX "listing_verifications_landlordId_idx" ON "listing_verifications"("landlordId");

-- CreateIndex
CREATE INDEX "listing_verifications_status_idx" ON "listing_verifications"("status");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "reviews_revieweeId_idx" ON "reviews"("revieweeId");

-- CreateIndex
CREATE INDEX "reviews_propertyId_idx" ON "reviews"("propertyId");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reviewerId_revieweeId_propertyId_key" ON "reviews"("reviewerId", "revieweeId", "propertyId");

-- CreateIndex
CREATE INDEX "trust_score_history_userId_idx" ON "trust_score_history"("userId");

-- CreateIndex
CREATE INDEX "trust_score_history_userType_idx" ON "trust_score_history"("userType");

-- CreateIndex
CREATE INDEX "trust_score_history_eventType_idx" ON "trust_score_history"("eventType");

-- CreateIndex
CREATE INDEX "trust_score_history_createdAt_idx" ON "trust_score_history"("createdAt");

-- CreateIndex
CREATE INDEX "document_access_logs_documentType_documentId_idx" ON "document_access_logs"("documentType", "documentId");

-- CreateIndex
CREATE INDEX "document_access_logs_userId_idx" ON "document_access_logs"("userId");

-- CreateIndex
CREATE INDEX "document_access_logs_createdAt_idx" ON "document_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_notificationType_idx" ON "notification_preferences"("notificationType");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_notificationType_channel_key" ON "notification_preferences"("userId", "notificationType", "channel");

-- CreateIndex
CREATE INDEX "lease_agreements_propertyId_idx" ON "lease_agreements"("propertyId");

-- CreateIndex
CREATE INDEX "rent_payments_leaseId_idx" ON "rent_payments"("leaseId");

-- CreateIndex
CREATE INDEX "rental_applications_paymentDeadline_idx" ON "rental_applications"("paymentDeadline");

-- AddForeignKey
ALTER TABLE "property_availability_windows" ADD CONSTRAINT "property_availability_windows_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "lease_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "lease_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_history" ADD CONSTRAINT "trust_score_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
