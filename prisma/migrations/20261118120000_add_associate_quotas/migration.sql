-- CreateEnum
CREATE TYPE "QuotaConcept" AS ENUM ('INSCRIPCION', 'CUOTA');

-- CreateEnum
CREATE TYPE "QuotaAccountingStatus" AS ENUM ('FACTURADO', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "QuotaSyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "QuotaSyncScope" AS ENUM ('PERSON', 'BATCH', 'FULL');

-- CreateEnum
CREATE TYPE "QuotaSyncItemStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'NO_DATA', 'NOT_FOUND', 'FAILED');

-- CreateTable
CREATE TABLE "associate_quotas" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER,
    "institutional_code" VARCHAR(50),
    "provider" VARCHAR(50) NOT NULL DEFAULT 'SIE',
    "document_type" "DocumentType" NOT NULL,
    "document_number_hash" VARCHAR(64) NOT NULL,
    "source_key" VARCHAR(160) NOT NULL,
    "source_payload_hash" VARCHAR(64) NOT NULL,
    "concept" "QuotaConcept" NOT NULL,
    "quota_number" INTEGER,
    "year" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "accounting_status" "QuotaAccountingStatus" NOT NULL,
    "membership_type" VARCHAR(40) NOT NULL,
    "paid_at" DATE,
    "period_start" DATE,
    "period_end" DATE,
    "receipt_serie" VARCHAR(20),
    "receipt_number" VARCHAR(30),
    "is_present_in_last_successful_sync" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associate_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_sync_runs" (
    "id" SERIAL NOT NULL,
    "status" "QuotaSyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "scope" "QuotaSyncScope" NOT NULL DEFAULT 'PERSON',
    "requested_by_user_id" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "total_associates" INTEGER NOT NULL DEFAULT 0,
    "processed_associates" INTEGER NOT NULL DEFAULT 0,
    "synced_associates" INTEGER NOT NULL DEFAULT 0,
    "no_data_associates" INTEGER NOT NULL DEFAULT 0,
    "failed_associates" INTEGER NOT NULL DEFAULT 0,
    "quotas_inserted" INTEGER NOT NULL DEFAULT 0,
    "quotas_updated" INTEGER NOT NULL DEFAULT 0,
    "quotas_unchanged" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_sync_items" (
    "id" SERIAL NOT NULL,
    "sync_run_id" INTEGER NOT NULL,
    "person_id" INTEGER,
    "institutional_code" VARCHAR(50),
    "identity_hash" VARCHAR(64) NOT NULL,
    "status" "QuotaSyncItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "quotas_recovered" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(100),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_sync_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "associate_quotas_source_key_key" ON "associate_quotas"("source_key");

-- CreateIndex
CREATE INDEX "associate_quotas_person_id_idx" ON "associate_quotas"("person_id");

-- CreateIndex
CREATE INDEX "associate_quotas_institutional_code_idx" ON "associate_quotas"("institutional_code");

-- CreateIndex
CREATE INDEX "associate_quotas_document_type_document_number_hash_idx" ON "associate_quotas"("document_type", "document_number_hash");

-- CreateIndex
CREATE INDEX "associate_quotas_year_idx" ON "associate_quotas"("year");

-- CreateIndex
CREATE INDEX "associate_quotas_accounting_status_idx" ON "associate_quotas"("accounting_status");

-- CreateIndex
CREATE INDEX "associate_quotas_is_present_in_last_successful_sync_idx" ON "associate_quotas"("is_present_in_last_successful_sync");

-- CreateIndex
CREATE INDEX "associate_quotas_last_seen_at_idx" ON "associate_quotas"("last_seen_at");

-- CreateIndex
CREATE INDEX "quota_sync_runs_status_idx" ON "quota_sync_runs"("status");

-- CreateIndex
CREATE INDEX "quota_sync_runs_started_at_idx" ON "quota_sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "quota_sync_runs_requested_by_user_id_idx" ON "quota_sync_runs"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "quota_sync_items_sync_run_id_status_idx" ON "quota_sync_items"("sync_run_id", "status");

-- CreateIndex
CREATE INDEX "quota_sync_items_person_id_idx" ON "quota_sync_items"("person_id");

-- CreateIndex
CREATE INDEX "quota_sync_items_institutional_code_idx" ON "quota_sync_items"("institutional_code");

-- CreateIndex
CREATE UNIQUE INDEX "quota_sync_items_sync_run_id_identity_hash_key" ON "quota_sync_items"("sync_run_id", "identity_hash");

-- AddForeignKey
ALTER TABLE "associate_quotas" ADD CONSTRAINT "associate_quotas_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_sync_runs" ADD CONSTRAINT "quota_sync_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_sync_items" ADD CONSTRAINT "quota_sync_items_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "quota_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_sync_items" ADD CONSTRAINT "quota_sync_items_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
