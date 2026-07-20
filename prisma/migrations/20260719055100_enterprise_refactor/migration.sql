/*
  Warnings:

  - You are about to drop the `cat_universities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "prof_academic_info" DROP CONSTRAINT "prof_academic_info_university_id_fkey";

-- DropTable
DROP TABLE "cat_universities";

-- CreateTable
CREATE TABLE "University" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "country_id" INTEGER NOT NULL,
    "acronym" VARCHAR(20),
    "website" VARCHAR(255),
    "isLicensed" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_acronym_key" ON "University"("acronym");

-- CreateIndex
CREATE INDEX "University_country_id_idx" ON "University"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "University_country_id_name_key" ON "University"("country_id", "name");

-- AddForeignKey
ALTER TABLE "prof_academic_info" ADD CONSTRAINT "prof_academic_info_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "cat_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
