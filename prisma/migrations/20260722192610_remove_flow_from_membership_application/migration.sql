/*
  Warnings:

  - You are about to drop the column `affiliate_type` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `application_code` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `correspondence_preference` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `current_step` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `draft_data` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `person_id` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_at` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `tracking_code` on the `membership_applications` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `membership_applications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[applicationCode]` on the table `membership_applications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[trackingCode]` on the table `membership_applications` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `affiliateType` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `applicationCode` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentNumber` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentType` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trackingCode` to the `membership_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `membership_applications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('START_APPLICATION', 'RESUME_APPLICATION', 'SUBMIT_APPLICATION');

-- CreateEnum
CREATE TYPE "ApplicationFlow" AS ENUM ('ACTIVE', 'STUDENT');

-- DropForeignKey
ALTER TABLE "membership_applications" DROP CONSTRAINT "membership_applications_person_id_fkey";

-- DropIndex
DROP INDEX "membership_applications_application_code_idx";

-- DropIndex
DROP INDEX "membership_applications_application_code_key";

-- DropIndex
DROP INDEX "membership_applications_person_id_idx";

-- DropIndex
DROP INDEX "membership_applications_person_id_status_idx";

-- DropIndex
DROP INDEX "membership_applications_tracking_code_idx";

-- DropIndex
DROP INDEX "membership_applications_tracking_code_key";

-- AlterTable
ALTER TABLE "membership_applications" DROP COLUMN "affiliate_type",
DROP COLUMN "application_code",
DROP COLUMN "correspondence_preference",
DROP COLUMN "created_at",
DROP COLUMN "current_step",
DROP COLUMN "deleted_at",
DROP COLUMN "draft_data",
DROP COLUMN "person_id",
DROP COLUMN "submitted_at",
DROP COLUMN "tracking_code",
DROP COLUMN "updated_at",
ADD COLUMN     "affiliateType" "AffiliateType" NOT NULL,
ADD COLUMN     "applicationCode" TEXT NOT NULL,
ADD COLUMN     "correspondencePreference" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT NOT NULL,
ADD COLUMN     "documentType" "DocumentType" NOT NULL,
ADD COLUMN     "draftData" JSONB,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastAccessAt" TIMESTAMP(3),
ADD COLUMN     "personId" INTEGER,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "trackingCode" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_applicationCode_key" ON "membership_applications"("applicationCode");

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_trackingCode_key" ON "membership_applications"("trackingCode");

-- CreateIndex
CREATE INDEX "membership_applications_documentNumber_idx" ON "membership_applications"("documentNumber");

-- CreateIndex
CREATE INDEX "membership_applications_documentNumber_status_idx" ON "membership_applications"("documentNumber", "status");

-- CreateIndex
CREATE INDEX "membership_applications_email_idx" ON "membership_applications"("email");

-- CreateIndex
CREATE INDEX "membership_applications_personId_idx" ON "membership_applications"("personId");

-- CreateIndex
CREATE INDEX "membership_applications_personId_status_idx" ON "membership_applications"("personId", "status");

-- CreateIndex
CREATE INDEX "membership_applications_applicationCode_idx" ON "membership_applications"("applicationCode");

-- CreateIndex
CREATE INDEX "membership_applications_trackingCode_idx" ON "membership_applications"("trackingCode");

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
