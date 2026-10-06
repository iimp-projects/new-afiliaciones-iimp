-- CreateEnum
CREATE TYPE "SieLinkStatus" AS ENUM ('LINKED', 'UNLINKED', 'CONFLICT');

-- CreateTable
CREATE TABLE "membership_categories" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "allows_login" BOOLEAN NOT NULL DEFAULT false,
    "mapped_affiliate_type" "AffiliateType",
    "mapped_role_slug" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sie_associate_records" (
    "id" SERIAL NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_code" VARCHAR(50) NOT NULL,
    "source_document_type" VARCHAR(20),
    "document_number" VARCHAR(50),
    "source_type" VARCHAR(10) NOT NULL,
    "source_description" VARCHAR(100),
    "person_id" INTEGER,
    "category_id" INTEGER,
    "link_status" "SieLinkStatus" NOT NULL DEFAULT 'UNLINKED',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sie_associate_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_categories_code_key" ON "membership_categories"("code");

-- CreateIndex
CREATE INDEX "sie_associate_records_person_id_idx" ON "sie_associate_records"("person_id");

-- CreateIndex
CREATE INDEX "sie_associate_records_document_number_idx" ON "sie_associate_records"("document_number");

-- CreateIndex
CREATE INDEX "sie_associate_records_source_type_idx" ON "sie_associate_records"("source_type");

-- CreateIndex
CREATE INDEX "sie_associate_records_link_status_idx" ON "sie_associate_records"("link_status");

-- CreateIndex
CREATE INDEX "sie_associate_records_category_id_idx" ON "sie_associate_records"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "sie_associate_records_provider_external_code_key" ON "sie_associate_records"("provider", "external_code");

-- AddForeignKey
ALTER TABLE "sie_associate_records" ADD CONSTRAINT "sie_associate_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sie_associate_records" ADD CONSTRAINT "sie_associate_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "membership_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
