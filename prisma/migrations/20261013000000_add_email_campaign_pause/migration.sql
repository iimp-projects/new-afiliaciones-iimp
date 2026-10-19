-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN "paused_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN "pause_reason" VARCHAR(500);
