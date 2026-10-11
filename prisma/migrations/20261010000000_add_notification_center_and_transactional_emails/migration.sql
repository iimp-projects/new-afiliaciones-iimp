-- CreateEnum
CREATE TYPE "TransactionalEmailStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'FAILED', 'RETRY_PENDING', 'EXHAUSTED');

-- AlterTable
ALTER TABLE "sys_notifications" ADD COLUMN     "type" VARCHAR(100);
ALTER TABLE "sys_notifications" ADD COLUMN     "severity" VARCHAR(20);
ALTER TABLE "sys_notifications" ADD COLUMN     "application_id" INTEGER;
ALTER TABLE "sys_notifications" ADD COLUMN     "entity_type" VARCHAR(100);
ALTER TABLE "sys_notifications" ADD COLUMN     "entity_id" VARCHAR(100);
ALTER TABLE "sys_notifications" ADD COLUMN     "metadata" JSONB;
ALTER TABLE "sys_notifications" ADD COLUMN     "dedup_key" VARCHAR(255);
ALTER TABLE "sys_notifications" ADD COLUMN     "href" VARCHAR(500);
ALTER TABLE "sys_notifications" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sys_transactional_emails" (
    "id" SERIAL NOT NULL,
    "event" VARCHAR(100),
    "template_name" VARCHAR(150),
    "application_id" INTEGER,
    "recipient" VARCHAR(255) NOT NULL,
    "status" "TransactionalEmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "message_id" VARCHAR(255),
    "smtp_accepted_at" TIMESTAMP(3),
    "last_error" TEXT,
    "requires_attention" BOOLEAN NOT NULL DEFAULT false,
    "correlation_id" VARCHAR(100),
    "idempotency_key" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_transactional_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_notifications_dedup_key_key" ON "sys_notifications"("dedup_key");

-- CreateIndex
CREATE INDEX "sys_notifications_user_id_created_at_idx" ON "sys_notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sys_transactional_emails_idempotency_key_key" ON "sys_transactional_emails"("idempotency_key");

-- CreateIndex
CREATE INDEX "sys_transactional_emails_application_id_idx" ON "sys_transactional_emails"("application_id");

-- CreateIndex
CREATE INDEX "sys_transactional_emails_status_idx" ON "sys_transactional_emails"("status");

-- CreateIndex
CREATE INDEX "sys_transactional_emails_recipient_idx" ON "sys_transactional_emails"("recipient");

-- CreateIndex
CREATE INDEX "sys_transactional_emails_created_at_idx" ON "sys_transactional_emails"("created_at");

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_transactional_emails" ADD CONSTRAINT "sys_transactional_emails_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
