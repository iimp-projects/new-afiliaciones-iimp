-- CreateTable
CREATE TABLE "associate_testimonials" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER,
    "document_number" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "role" VARCHAR(150) NOT NULL,
    "institution" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "avatar_url" VARCHAR(500),
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associate_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "associate_testimonials_document_number_idx" ON "associate_testimonials"("document_number");

-- CreateIndex
CREATE INDEX "associate_testimonials_person_id_idx" ON "associate_testimonials"("person_id");

-- CreateIndex
CREATE INDEX "associate_testimonials_is_approved_idx" ON "associate_testimonials"("is_approved");

-- CreateIndex
CREATE INDEX "associate_testimonials_display_order_idx" ON "associate_testimonials"("display_order");

-- AddForeignKey
ALTER TABLE "associate_testimonials" ADD CONSTRAINT "associate_testimonials_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
