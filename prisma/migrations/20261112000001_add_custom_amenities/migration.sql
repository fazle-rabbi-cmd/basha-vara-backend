-- Add isCustom column to amenities
ALTER TABLE "amenities" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- Add createdBy column to amenities
ALTER TABLE "amenities" ADD COLUMN "createdBy" UUID;

-- Add usageCount column to amenities
ALTER TABLE "amenities" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint on name
ALTER TABLE "amenities" DROP CONSTRAINT IF EXISTS "amenities_name_key";

-- Add new unique constraint on (name, isCustom)
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_name_isCustom_key" UNIQUE ("name", "isCustom");

-- Add index on isCustom
CREATE INDEX IF NOT EXISTS "amenities_isCustom_idx" ON "amenities"("isCustom");

-- Add index on createdBy
CREATE INDEX IF NOT EXISTS "amenities_createdBy_idx" ON "amenities"("createdBy");

-- Add foreign key constraint to users
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
