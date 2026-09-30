-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'COMPLETED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'ERROR');

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "html_content" TEXT NOT NULL,
    "text_content" TEXT,
    "sender_name" VARCHAR(200),
    "sender_email" VARCHAR(200),
    "reply_to" VARCHAR(200),
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_recipients" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(200),
    "company" VARCHAR(200),
    "position" VARCHAR(200),
    "phone" VARCHAR(50),
    "ruc" VARCHAR(20),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_recipient_lists" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "source_file" VARCHAR(500),
    "source_sheet" VARCHAR(200),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_recipient_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_recipient_list_members" (
    "list_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_recipient_list_members_pkey" PRIMARY KEY ("list_id","recipient_id")
);

-- CreateTable
CREATE TABLE "email_campaign_recipients" (
    "campaign_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "last_sent_at" TIMESTAMP(3),
    "send_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_recipients_pkey" PRIMARY KEY ("campaign_id","recipient_id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER,
    "recipient_id" INTEGER,
    "email" VARCHAR(320) NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "message_id" VARCHAR(500),
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_campaigns_created_by_idx" ON "email_campaigns"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "email_recipients_email_key" ON "email_recipients"("email");

-- CreateIndex
CREATE INDEX "email_recipient_lists_created_by_idx" ON "email_recipient_lists"("created_by");

-- CreateIndex
CREATE INDEX "email_recipient_list_members_recipient_id_idx" ON "email_recipient_list_members"("recipient_id");

-- CreateIndex
CREATE INDEX "email_campaign_recipients_recipient_id_idx" ON "email_campaign_recipients"("recipient_id");

-- CreateIndex
CREATE INDEX "email_campaign_recipients_status_idx" ON "email_campaign_recipients"("status");

-- CreateIndex
CREATE INDEX "email_deliveries_campaign_id_idx" ON "email_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "email_deliveries_recipient_id_idx" ON "email_deliveries"("recipient_id");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_campaign_id_recipient_id_attempt_number_key" ON "email_deliveries"("campaign_id", "recipient_id", "attempt_number");

-- CreateIndex (partial unique, no representable en schema.prisma)
-- Garantiza que para una combinación (campaign_id, recipient_id) exista como
-- máximo UN delivery en estado PENDING o SENDING al mismo tiempo. Es el mecanismo
-- principal anti doble-envío: el INSERT de un segundo delivery activo falla con
-- una violación única ANTES de llegar a SMTP.
CREATE UNIQUE INDEX "email_deliveries_inflight_key" ON "email_deliveries"("campaign_id", "recipient_id") WHERE "status" IN ('PENDING', 'SENDING');

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recipient_lists" ADD CONSTRAINT "email_recipient_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recipient_list_members" ADD CONSTRAINT "email_recipient_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "email_recipient_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recipient_list_members" ADD CONSTRAINT "email_recipient_list_members_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "email_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "email_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "email_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
