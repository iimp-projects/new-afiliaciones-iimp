-- Migración aditiva: integración de billeteras digitales con el carné existente.
-- No modifica ni elimina datos del carné institucional.

CREATE TYPE "CardWalletProvider" AS ENUM ('GOOGLE', 'APPLE');

CREATE TYPE "CardWalletSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'REVOKED');

CREATE TABLE "card_wallet_passes" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "provider" "CardWalletProvider" NOT NULL,
    "external_pass_id" VARCHAR(255) NOT NULL,
    "sync_status" "CardWalletSyncStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_error_code" VARCHAR(80),
    "last_synced_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_wallet_passes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "apple_pass_registrations" (
    "id" TEXT NOT NULL,
    "pass_id" TEXT NOT NULL,
    "device_library_identifier" VARCHAR(160) NOT NULL,
    "push_token" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apple_pass_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_wallet_passes_card_id_provider_key" ON "card_wallet_passes"("card_id", "provider");
CREATE UNIQUE INDEX "card_wallet_passes_provider_external_pass_id_key" ON "card_wallet_passes"("provider", "external_pass_id");
CREATE INDEX "card_wallet_passes_provider_sync_status_idx" ON "card_wallet_passes"("provider", "sync_status");
CREATE UNIQUE INDEX "apple_pass_registrations_pass_id_device_library_identifier_key" ON "apple_pass_registrations"("pass_id", "device_library_identifier");
CREATE INDEX "apple_pass_registrations_device_library_identifier_idx" ON "apple_pass_registrations"("device_library_identifier");

ALTER TABLE "card_wallet_passes" ADD CONSTRAINT "card_wallet_passes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "associate_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "apple_pass_registrations" ADD CONSTRAINT "apple_pass_registrations_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "card_wallet_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
