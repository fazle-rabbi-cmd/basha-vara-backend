-- Drop unused columns from tenant_profiles
ALTER TABLE "tenant_profiles" DROP COLUMN IF EXISTS "moveInDatePreference";
ALTER TABLE "tenant_profiles" DROP COLUMN IF EXISTS "preferredLocations";
ALTER TABLE "tenant_profiles" DROP COLUMN IF EXISTS "preferredPropertyTypes";

-- Drop unused columns from landlord_profiles
ALTER TABLE "landlord_profiles" DROP COLUMN IF EXISTS "verified";
ALTER TABLE "landlord_profiles" DROP COLUMN IF EXISTS "responseRate";

-- Drop unused document_access_logs table
DROP TABLE IF EXISTS "document_access_logs";
