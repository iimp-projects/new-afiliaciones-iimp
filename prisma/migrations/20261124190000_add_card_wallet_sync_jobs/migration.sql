-- Outbox persistente de sincronización Wallet. Migración aditiva.

CREATE TYPE "CardWalletSyncOperation" AS ENUM ('SYNC', 'REVOKE');

CREATE TYPE "CardWalletSyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'RETRY', 'FAILED', 'SUPERSEDED');

CREATE TABLE "card_wallet_sync_jobs" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "wallet_pass_id" TEXT NOT NULL,
    "provider" "CardWalletProvider" NOT NULL,
    "operation" "CardWalletSyncOperation" NOT NULL DEFAULT 'SYNC',
    "status" "CardWalletSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "target_version" INTEGER NOT NULL DEFAULT 1,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(120),
    "lease_expires_at" TIMESTAMP(3),
    "last_error_code" VARCHAR(80),
    "last_error_message" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "card_wallet_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_wallet_sync_jobs_wallet_pass_id_key" ON "card_wallet_sync_jobs"("wallet_pass_id");
CREATE INDEX "card_wallet_sync_jobs_status_next_attempt_at_idx" ON "card_wallet_sync_jobs"("status", "next_attempt_at");
CREATE INDEX "card_wallet_sync_jobs_card_id_idx" ON "card_wallet_sync_jobs"("card_id");

ALTER TABLE "card_wallet_sync_jobs" ADD CONSTRAINT "card_wallet_sync_jobs_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "associate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_wallet_sync_jobs" ADD CONSTRAINT "card_wallet_sync_jobs_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "card_wallet_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
