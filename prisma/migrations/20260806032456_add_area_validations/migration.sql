-- CreateTable
CREATE TABLE "membership_area_validations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "status" "ObservationStatus" NOT NULL DEFAULT 'PENDING',
    "validated_by_id" INTEGER,
    "validated_at" TIMESTAMP(3),
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_area_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membership_area_validations_application_id_idx" ON "membership_area_validations"("application_id");

-- CreateIndex
CREATE INDEX "membership_area_validations_department_idx" ON "membership_area_validations"("department");

-- AddForeignKey
ALTER TABLE "membership_area_validations" ADD CONSTRAINT "membership_area_validations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_area_validations" ADD CONSTRAINT "membership_area_validations_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
