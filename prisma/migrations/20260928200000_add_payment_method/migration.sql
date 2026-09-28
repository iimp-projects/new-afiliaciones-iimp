-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'WALLET', 'BANK_TRANSFER', 'CASH', 'POINTS', 'UNKNOWN');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "payment_brand" TEXT;
