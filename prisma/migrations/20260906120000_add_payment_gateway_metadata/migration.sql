ALTER TABLE "payments"
  ADD COLUMN "gateway_transaction_date" TIMESTAMP(3),
  ADD COLUMN "card_brand" TEXT,
  ADD COLUMN "masked_card" TEXT,
  ADD COLUMN "payment_channel" TEXT;
