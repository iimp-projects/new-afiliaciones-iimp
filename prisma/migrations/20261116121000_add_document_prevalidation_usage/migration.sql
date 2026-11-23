-- AlterTable
ALTER TABLE "document_prevalidations"
    ADD COLUMN "token_usage" JSONB,
    ADD COLUMN "attempts" INTEGER;
