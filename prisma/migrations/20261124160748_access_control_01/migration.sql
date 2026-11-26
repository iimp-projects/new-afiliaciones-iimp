-- CreateEnum
CREATE TYPE "AccessMovementMode" AS ENUM ('ENTRY', 'EXIT', 'BOTH');

-- CreateEnum
CREATE TYPE "AccessSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'ADMINISTRATIVELY_CLOSED');

-- CreateEnum
CREATE TYPE "AccessMovementType" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "AccessValidationResult" AS ENUM ('ALLOWED', 'DENIED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "AccessMovementSource" AS ENUM ('QR_USB', 'QR_CAMERA', 'MANUAL_SEARCH', 'ADMIN_OVERRIDE');

-- CreateTable
CREATE TABLE "access_sites" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(250),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_points" (
    "id" SERIAL NOT NULL,
    "site_id" INTEGER NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "movement_mode" "AccessMovementMode" NOT NULL DEFAULT 'BOTH',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_sessions" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "entry_point_id" INTEGER NOT NULL,
    "exit_point_id" INTEGER,
    "entry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exit_at" TIMESTAMP(3),
    "entry_registered_by" INTEGER,
    "exit_registered_by" INTEGER,
    "status" "AccessSessionStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_movements" (
    "id" TEXT NOT NULL,
    "person_id" INTEGER NOT NULL,
    "card_id" TEXT,
    "site_id" INTEGER NOT NULL,
    "access_point_id" INTEGER NOT NULL,
    "session_id" INTEGER,
    "movement_type" "AccessMovementType" NOT NULL,
    "validation_result" "AccessValidationResult" NOT NULL,
    "reason_code" VARCHAR(60),
    "source" "AccessMovementSource" NOT NULL,
    "registered_by" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(100),

    CONSTRAINT "access_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_policies" (
    "id" SERIAL NOT NULL,
    "site_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "allowed_membership_categories" JSONB,
    "require_active_membership" BOOLEAN NOT NULL DEFAULT true,
    "require_valid_card" BOOLEAN NOT NULL DEFAULT true,
    "quota_restriction_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_pending_quotas" INTEGER,
    "allow_manual_lookup" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_operator_assignments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "access_point_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_operator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_sites_code_key" ON "access_sites"("code");

-- CreateIndex
CREATE INDEX "access_sites_is_active_idx" ON "access_sites"("is_active");

-- CreateIndex
CREATE INDEX "access_points_site_id_idx" ON "access_points"("site_id");

-- CreateIndex
CREATE INDEX "access_points_is_active_idx" ON "access_points"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "access_points_site_id_code_key" ON "access_points"("site_id", "code");

-- CreateIndex
CREATE INDEX "access_sessions_person_id_idx" ON "access_sessions"("person_id");

-- CreateIndex
CREATE INDEX "access_sessions_site_id_idx" ON "access_sessions"("site_id");

-- CreateIndex
CREATE INDEX "access_sessions_status_idx" ON "access_sessions"("status");

-- CreateIndex
CREATE INDEX "access_sessions_entry_at_idx" ON "access_sessions"("entry_at");

-- CreateIndex
CREATE INDEX "access_sessions_person_id_site_id_status_idx" ON "access_sessions"("person_id", "site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "access_movements_idempotency_key_key" ON "access_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "access_movements_person_id_idx" ON "access_movements"("person_id");

-- CreateIndex
CREATE INDEX "access_movements_site_id_idx" ON "access_movements"("site_id");

-- CreateIndex
CREATE INDEX "access_movements_access_point_id_idx" ON "access_movements"("access_point_id");

-- CreateIndex
CREATE INDEX "access_movements_occurred_at_idx" ON "access_movements"("occurred_at");

-- CreateIndex
CREATE INDEX "access_movements_movement_type_idx" ON "access_movements"("movement_type");

-- CreateIndex
CREATE INDEX "access_movements_validation_result_idx" ON "access_movements"("validation_result");

-- CreateIndex
CREATE INDEX "access_movements_registered_by_idx" ON "access_movements"("registered_by");

-- CreateIndex
CREATE INDEX "access_movements_session_id_idx" ON "access_movements"("session_id");

-- CreateIndex
CREATE INDEX "access_policies_site_id_idx" ON "access_policies"("site_id");

-- CreateIndex
CREATE INDEX "access_policies_is_active_idx" ON "access_policies"("is_active");

-- CreateIndex
CREATE INDEX "access_operator_assignments_user_id_idx" ON "access_operator_assignments"("user_id");

-- CreateIndex
CREATE INDEX "access_operator_assignments_site_id_idx" ON "access_operator_assignments"("site_id");

-- CreateIndex
CREATE INDEX "access_operator_assignments_access_point_id_idx" ON "access_operator_assignments"("access_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_operator_assignments_user_id_site_id_access_point_id_key" ON "access_operator_assignments"("user_id", "site_id", "access_point_id");

-- AddForeignKey
ALTER TABLE "access_points" ADD CONSTRAINT "access_points_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "access_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "access_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_entry_point_id_fkey" FOREIGN KEY ("entry_point_id") REFERENCES "access_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_exit_point_id_fkey" FOREIGN KEY ("exit_point_id") REFERENCES "access_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_entry_registered_by_fkey" FOREIGN KEY ("entry_registered_by") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_exit_registered_by_fkey" FOREIGN KEY ("exit_registered_by") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "associate_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "access_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "access_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_movements" ADD CONSTRAINT "access_movements_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "access_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_operator_assignments" ADD CONSTRAINT "access_operator_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_operator_assignments" ADD CONSTRAINT "access_operator_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "access_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_operator_assignments" ADD CONSTRAINT "access_operator_assignments_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garantiza una única sesión abierta por persona y sede (índice único parcial).
CREATE UNIQUE INDEX "access_sessions_open_person_site_key"
  ON "access_sessions"("person_id", "site_id")
  WHERE "status" = 'OPEN';
