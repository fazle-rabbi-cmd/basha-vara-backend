-- CreateTable
CREATE TABLE "police_verifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "applicationId" UUID,
    "landlordId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "formData" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "police_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "police_verifications_tenantId_idx" ON "police_verifications"("tenantId");
CREATE INDEX "police_verifications_propertyId_idx" ON "police_verifications"("propertyId");
CREATE INDEX "police_verifications_landlordId_idx" ON "police_verifications"("landlordId");
CREATE INDEX "police_verifications_status_idx" ON "police_verifications"("status");

-- AddForeignKey
ALTER TABLE "police_verifications" ADD CONSTRAINT "police_verifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "police_verifications" ADD CONSTRAINT "police_verifications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "police_verifications" ADD CONSTRAINT "police_verifications_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
