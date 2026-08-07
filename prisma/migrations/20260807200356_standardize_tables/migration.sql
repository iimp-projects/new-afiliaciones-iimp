/*
  Warnings:

  - The values [SUBMITTED,AWAITING_ENDORSEMENTS,UNDER_EVALUATION,APPROVED,CANCELLED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Benefit` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'UNDER_EVALUATION', 'OBSERVED', 'RESOLVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidationAction" AS ENUM ('START_REVIEW', 'OBSERVED', 'SUBMITTED_CORRECTION', 'APPROVED', 'REJECTED', 'REOPENED');

-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('DRAFT', 'PENDING', 'UNDER_EVALUACION', 'OBSERVED', 'RESOLVED', 'READY_FOR_PAYMENT', 'COMPLETED', 'REJECTED');
ALTER TABLE "public"."membership_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "membership_applications" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING ("status"::text::"ApplicationStatus_new");
ALTER TABLE "membership_history" ALTER COLUMN "previous_status" TYPE "ApplicationStatus_new" USING ("previous_status"::text::"ApplicationStatus_new");
ALTER TABLE "membership_history" ALTER COLUMN "new_status" TYPE "ApplicationStatus_new" USING ("new_status"::text::"ApplicationStatus_new");
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "membership_applications" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropIndex
DROP INDEX "catalog_universities_acronym_key";

-- DropTable
DROP TABLE "Benefit";

-- CreateTable
CREATE TABLE "cat_benefits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "badgeText" TEXT,
    "redirectUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_membership_departments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalog_membership_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_validations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validated_by_id" INTEGER,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_validation_history" (
    "id" SERIAL NOT NULL,
    "validation_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action" "ValidationAction" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_validation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cat_benefits_slug_key" ON "cat_benefits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_membership_departments_code_key" ON "catalog_membership_departments"("code");

-- CreateIndex
CREATE INDEX "membership_validations_application_id_idx" ON "membership_validations"("application_id");

-- CreateIndex
CREATE INDEX "membership_validations_department_id_idx" ON "membership_validations"("department_id");

-- CreateIndex
CREATE INDEX "membership_validations_status_idx" ON "membership_validations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "membership_validations_application_id_department_id_key" ON "membership_validations"("application_id", "department_id");

-- CreateIndex
CREATE INDEX "membership_validation_history_validation_id_idx" ON "membership_validation_history"("validation_id");

-- AddForeignKey
ALTER TABLE "membership_validations" ADD CONSTRAINT "membership_validations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_validations" ADD CONSTRAINT "membership_validations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "catalog_membership_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_validations" ADD CONSTRAINT "membership_validations_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_validation_history" ADD CONSTRAINT "membership_validation_history_validation_id_fkey" FOREIGN KEY ("validation_id") REFERENCES "membership_validations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_validation_history" ADD CONSTRAINT "membership_validation_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
