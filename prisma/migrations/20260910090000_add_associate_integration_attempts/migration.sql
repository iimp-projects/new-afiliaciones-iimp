CREATE TYPE "AssociateIntegrationAttemptResult" AS ENUM ('SYNCED', 'RETRYABLE', 'FAILED');

CREATE TABLE "associate_integration_attempts" (
    "id" SERIAL NOT NULL,
    "integration_id" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "result" "AssociateIntegrationAttemptResult",
    "http_status" INTEGER,
    "error_code" VARCHAR(100),
    "message" TEXT,
    "error_identifier" VARCHAR(255),
    "error_details" JSONB,
    "external_associate_code" INTEGER,
    "external_message" TEXT,
    "duration_ms" INTEGER,
    CONSTRAINT "associate_integration_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "associate_integration_attempts_integration_id_attempt_number_key"
  ON "associate_integration_attempts"("integration_id", "attempt_number");
CREATE INDEX "associate_integration_attempts_integration_id_started_at_idx"
  ON "associate_integration_attempts"("integration_id", "started_at");

ALTER TABLE "associate_integration_attempts"
  ADD CONSTRAINT "associate_integration_attempts_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "associate_integrations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
