/*
  Warnings:

  - You are about to drop the `application_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `application_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "application_profiles" DROP CONSTRAINT "application_profiles_userId_fkey";

-- DropTable
DROP TABLE "application_documents";

-- DropTable
DROP TABLE "application_profiles";
