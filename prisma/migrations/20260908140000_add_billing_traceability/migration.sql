CREATE TYPE "BillingDocumentType" AS ENUM ('DNI', 'CE', 'RUC');
CREATE TYPE "BillingReceiptType" AS ENUM ('BOLETA', 'FACTURA');
CREATE TYPE "BillingVerificationSource" AS ENUM ('PERSON_DATA', 'SUNAT', 'MANUAL');
CREATE TYPE "BillingVerificationStatus" AS ENUM ('VERIFIED', 'NOT_VERIFIED');

ALTER TABLE "billings"
  ADD COLUMN "document_type" "BillingDocumentType",
  ADD COLUMN "receipt_type" "BillingReceiptType",
  ADD COLUMN "billing_contact" VARCHAR(150),
  ADD COLUMN "verification_source" "BillingVerificationSource",
  ADD COLUMN "verification_status" "BillingVerificationStatus",
  ADD COLUMN "verified_business_name" VARCHAR(250),
  ADD COLUMN "verified_billing_address" VARCHAR(250),
  ADD COLUMN "verified_tax_status" VARCHAR(80),
  ADD COLUMN "verified_tax_condition" VARCHAR(80),
  ADD COLUMN "verified_at" TIMESTAMP(3);
