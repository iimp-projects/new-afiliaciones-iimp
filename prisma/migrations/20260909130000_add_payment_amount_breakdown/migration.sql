-- Nullable columns preserve historical payments without inventing a breakdown.
ALTER TABLE "payments"
  ADD COLUMN "registration_amount" DECIMAL(10,2),
  ADD COLUMN "membership_fee_amount" DECIMAL(10,2);
