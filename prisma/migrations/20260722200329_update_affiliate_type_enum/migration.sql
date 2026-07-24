/*
  Warnings:

  - The values [REGULAR,SENIOR,HONORARY] on the enum `AffiliateType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AffiliateType_new" AS ENUM ('ACTIVE', 'STUDENT');
ALTER TABLE "membership_applications" ALTER COLUMN "affiliateType" TYPE "AffiliateType_new" USING ("affiliateType"::text::"AffiliateType_new");
ALTER TYPE "AffiliateType" RENAME TO "AffiliateType_old";
ALTER TYPE "AffiliateType_new" RENAME TO "AffiliateType";
DROP TYPE "public"."AffiliateType_old";
COMMIT;

-- DropEnum
DROP TYPE "ApplicationFlow";
