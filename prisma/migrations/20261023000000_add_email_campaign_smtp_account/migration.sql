-- CreateEnum
CREATE TYPE "EmailSmtpAccount" AS ENUM ('DEFAULT', 'PROV');

-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN "smtp_account" "EmailSmtpAccount" NOT NULL DEFAULT 'DEFAULT';
