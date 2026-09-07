ALTER TABLE "payments"
  ADD COLUMN "action_code" TEXT,
  ADD COLUMN "card_type" TEXT,
  ADD COLUMN "trace_number" TEXT;
