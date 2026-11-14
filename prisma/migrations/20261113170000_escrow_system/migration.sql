-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('NOT_APPLICABLE', 'HELD', 'RELEASED', 'REFUNDED', 'DISPUTED', 'PARTIALLY_RELEASED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "escrowStatus" "EscrowStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "payments" ADD COLUMN "escrowReleasedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "escrowRefundedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "escrowDisputedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "platformFee" DECIMAL(12,2);
ALTER TABLE "payments" ADD COLUMN "landlordAmount" DECIMAL(12,2);
ALTER TABLE "payments" ADD COLUMN "tenantAmount" DECIMAL(12,2);
ALTER TABLE "payments" ADD COLUMN "releaseReason" TEXT;
ALTER TABLE "payments" ADD COLUMN "refundReason" TEXT;

-- CreateIndex
CREATE INDEX "payments_escrowStatus_idx" ON "payments"("escrowStatus");
