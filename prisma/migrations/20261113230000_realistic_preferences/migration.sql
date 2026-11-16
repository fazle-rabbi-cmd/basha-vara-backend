-- AlterTable
ALTER TABLE "properties" ADD COLUMN "maxOccupancy" INTEGER,
ADD COLUMN "minChildrenAge" INTEGER,
ADD COLUMN "maxChildrenAge" INTEGER,
ADD COLUMN "allowInfants" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowToddlers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowSchoolAge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowTeens" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "quietHoursStart" TEXT,
ADD COLUMN "quietHoursEnd" TEXT;
