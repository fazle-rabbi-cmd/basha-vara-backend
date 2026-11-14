-- AlterTable
ALTER TABLE "properties" ADD COLUMN "allowedOccupation" TEXT,
ADD COLUMN "allowedMaritalStatus" TEXT,
ADD COLUMN "allowedFamilyType" TEXT,
ADD COLUMN "maxFamilySize" INTEGER,
ADD COLUMN "allowPets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowSmoking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "strictReturnTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minReturnTime" TEXT,
ADD COLUMN "preferredGender" TEXT;

-- AlterTable
ALTER TABLE "tenant_profiles" ADD COLUMN "maritalStatus" TEXT,
ADD COLUMN "hasChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "childrenCount" INTEGER,
ADD COLUMN "hasPets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "petType" TEXT,
ADD COLUMN "smokingStatus" TEXT,
ADD COLUMN "returnTimePreference" TEXT,
ADD COLUMN "gender" TEXT;
