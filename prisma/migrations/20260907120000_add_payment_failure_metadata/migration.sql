ALTER TABLE "payments"
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "gateway_error_code" TEXT,
  ADD COLUMN "failure_at" TIMESTAMP(3);
