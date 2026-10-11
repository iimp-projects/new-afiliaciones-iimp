-- CreateEnum
CREATE TYPE "AssociateCardStatus" AS ENUM ('ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "associate_cards" (
    "id" TEXT NOT NULL,
    "person_id" INTEGER NOT NULL,
    "verification_token" VARCHAR(64) NOT NULL,
    "status" "AssociateCardStatus" NOT NULL DEFAULT 'ISSUED',
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "associate_cards_person_id_key" ON "associate_cards"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "associate_cards_verification_token_key" ON "associate_cards"("verification_token");

-- AddForeignKey
ALTER TABLE "associate_cards" ADD CONSTRAINT "associate_cards_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
