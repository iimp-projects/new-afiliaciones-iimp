/*
  Warnings:

  - You are about to drop the `cat_benefits` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "cat_benefits";

-- CreateTable
CREATE TABLE "catalog_benefits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT NOT NULL,
    "badgeText" TEXT,
    "redirectUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_benefits_slug_key" ON "catalog_benefits"("slug");
