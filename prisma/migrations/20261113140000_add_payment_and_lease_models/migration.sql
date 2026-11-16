-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SECURITY_DEPOSIT', 'FIRST_MONTH_RENT', 'PROCESSING_FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'TERMINATED');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT UNIQUE,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_applicationId_idx" ON "payments"("applicationId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "rental_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "lease_agreements" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "terms" JSONB NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "landlordSigned" BOOLEAN NOT NULL DEFAULT false,
    "tenantSigned" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "landlordSignatureData" TEXT,
    "tenantSignatureData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lease_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lease_agreements_applicationId_key" ON "lease_agreements"("applicationId");

-- CreateIndex
CREATE INDEX "lease_agreements_landlordId_idx" ON "lease_agreements"("landlordId");

-- CreateIndex
CREATE INDEX "lease_agreements_tenantId_idx" ON "lease_agreements"("tenantId");

-- CreateIndex
CREATE INDEX "lease_agreements_status_idx" ON "lease_agreements"("status");

-- AddForeignKey
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "rental_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
