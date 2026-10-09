-- CreateEnum
CREATE TYPE "EmailSmtpAccount" AS ENUM ('DEFAULT', 'PROV');

-- AlterTable: añade la cuenta SMTP por campaña. Las campañas existentes quedan en
-- 'PROV' (cuenta de campañas), preservando el comportamiento histórico.
ALTER TABLE "email_campaigns" ADD COLUMN "smtp_account" "EmailSmtpAccount" NOT NULL DEFAULT 'PROV';
