-- Create new enum type for PaymentType with BOOKING_DEPOSIT
CREATE TYPE "PaymentType_new" AS ENUM ('BOOKING_DEPOSIT', 'SECURITY_DEPOSIT', 'FIRST_MONTH_RENT', 'PROCESSING_FEE');

-- Update payments table to use new enum
ALTER TABLE "payments" ALTER COLUMN "paymentType" TYPE "PaymentType_new" USING "paymentType"::text::"PaymentType_new";

-- Drop old enum
DROP TYPE "PaymentType";

-- Rename new enum
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";

-- Add visit verification fields to visit_requests
ALTER TABLE "visit_requests" ADD COLUMN "tokenHoldAmount" DECIMAL(12,2);
ALTER TABLE "visit_requests" ADD COLUMN "tokenHoldExpiresAt" TIMESTAMP(3);
ALTER TABLE "visit_requests" ADD COLUMN "landlordOtp" TEXT;
ALTER TABLE "visit_requests" ADD COLUMN "tenantOtp" TEXT;
ALTER TABLE "visit_requests" ADD COLUMN "landlordOtpVerifiedAt" TIMESTAMP(3);
ALTER TABLE "visit_requests" ADD COLUMN "tenantOtpVerifiedAt" TIMESTAMP(3);
ALTER TABLE "visit_requests" ADD COLUMN "visitVerifiedAt" TIMESTAMP(3);
ALTER TABLE "visit_requests" ADD COLUMN "checkInLocation" JSONB;
ALTER TABLE "visit_requests" ADD COLUMN "checkInPhotoUrl" TEXT;

-- Add property lock fields
ALTER TABLE "properties" ADD COLUMN "lockedByVisitId" UUID;
ALTER TABLE "properties" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Add verified visit tracking to applications
ALTER TABLE "rental_applications" ADD COLUMN "verifiedVisitId" UUID;

-- Create indexes
CREATE INDEX "properties_lockedByVisitId_idx" ON "properties"("lockedByVisitId");
CREATE INDEX "rental_applications_verifiedVisitId_idx" ON "rental_applications"("verifiedVisitId");
