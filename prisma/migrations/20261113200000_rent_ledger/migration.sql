-- CreateTable
CREATE TABLE "rent_payments" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_charges" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "chargeType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rent_payments_propertyId_idx" ON "rent_payments"("propertyId");
CREATE INDEX "rent_payments_tenantId_idx" ON "rent_payments"("tenantId");
CREATE INDEX "rent_payments_landlordId_idx" ON "rent_payments"("landlordId");
CREATE INDEX "rent_payments_status_idx" ON "rent_payments"("status");
CREATE INDEX "rent_payments_dueDate_idx" ON "rent_payments"("dueDate");

-- CreateIndex
CREATE INDEX "utility_charges_propertyId_idx" ON "utility_charges"("propertyId");
CREATE INDEX "utility_charges_tenantId_idx" ON "utility_charges"("tenantId");
CREATE INDEX "utility_charges_landlordId_idx" ON "utility_charges"("landlordId");
CREATE INDEX "utility_charges_status_idx" ON "utility_charges"("status");
CREATE INDEX "utility_charges_billingMonth_idx" ON "utility_charges"("billingMonth");

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_charges" ADD CONSTRAINT "utility_charges_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "utility_charges" ADD CONSTRAINT "utility_charges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "utility_charges" ADD CONSTRAINT "utility_charges_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
