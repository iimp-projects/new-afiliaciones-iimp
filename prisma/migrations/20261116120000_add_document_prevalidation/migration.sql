-- CreateEnum
CREATE TYPE "DocumentPrevalidationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'TECHNICAL_ERROR');

-- CreateEnum
CREATE TYPE "DocumentPrevalidationResult" AS ENUM ('PREVALIDATED', 'OBSERVED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "document_prevalidations" (
    "id" TEXT NOT NULL,
    "application_id" INTEGER NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(250) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "status" "DocumentPrevalidationStatus" NOT NULL DEFAULT 'PENDING',
    "result" "DocumentPrevalidationResult",
    "extraction" JSONB,
    "rules" JSONB,
    "warnings" JSONB,
    "model_used" VARCHAR(100),
    "model_version" VARCHAR(100),
    "extraction_schema_version" VARCHAR(20) NOT NULL,
    "prompt_version" VARCHAR(20) NOT NULL,
    "rules_version" VARCHAR(20) NOT NULL,
    "duration_ms" INTEGER,
    "extraction_ms" INTEGER,
    "rules_ms" INTEGER,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(80),
    "analyzed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_prevalidations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_prevalidations_application_id_created_at_idx" ON "document_prevalidations"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "document_prevalidations_application_id_file_hash_idx" ON "document_prevalidations"("application_id", "file_hash");

-- CreateIndex
CREATE INDEX "document_prevalidations_file_hash_idx" ON "document_prevalidations"("file_hash");

-- CreateIndex
CREATE INDEX "document_prevalidations_status_idx" ON "document_prevalidations"("status");

-- AddForeignKey
ALTER TABLE "document_prevalidations" ADD CONSTRAINT "document_prevalidations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
