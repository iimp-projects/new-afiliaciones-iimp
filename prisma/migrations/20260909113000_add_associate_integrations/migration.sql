-- Durable outbox for the external Associates API. No historical rows are backfilled.
CREATE TYPE "AssociateIntegrationTrigger" AS ENUM ('ACTIVE_PAYMENT', 'STUDENT_COMPLETION');
CREATE TYPE "AssociateIntegrationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'RETRYABLE', 'FAILED');

CREATE TABLE "associate_integrations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "trigger" "AssociateIntegrationTrigger" NOT NULL,
    "status" "AssociateIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "request_payload_snapshot" JSONB NOT NULL,
    "external_associate_code" INTEGER,
    "external_message" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "last_error_http_status" INTEGER,
    "last_error_code" VARCHAR(100),
    "last_error_message" TEXT,
    "last_error_identifier" VARCHAR(255),
    "last_error_details" JSONB,
    "external_receipt_type" VARCHAR(10),
    "external_receipt_serie" VARCHAR(20),
    "external_receipt_number" VARCHAR(30),
    "external_receipt_pdf_reference" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "associate_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "associate_integrations_application_id_key" ON "associate_integrations"("application_id");
CREATE INDEX "associate_integrations_status_idx" ON "associate_integrations"("status");
CREATE INDEX "associate_integrations_trigger_idx" ON "associate_integrations"("trigger");

ALTER TABLE "associate_integrations"
  ADD CONSTRAINT "associate_integrations_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
