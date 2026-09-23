-- Operational alert persistence: lifecycle, assignment, resolution, and notes.
CREATE TYPE "OperationalAlertStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "operational_alert_trackings" (
  "id" SERIAL NOT NULL,
  "alert_key" VARCHAR(255) NOT NULL,
  "application_id" INTEGER NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "status" "OperationalAlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "assigned_user_id" INTEGER,
  "first_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolved_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_alert_trackings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_alert_notes" (
  "id" SERIAL NOT NULL,
  "alert_tracking_id" INTEGER NOT NULL,
  "author_user_id" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_alert_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_alert_trackings_alert_key_key"
  ON "operational_alert_trackings"("alert_key");
CREATE INDEX "operational_alert_trackings_application_id_idx"
  ON "operational_alert_trackings"("application_id");
CREATE INDEX "operational_alert_trackings_assigned_user_id_idx"
  ON "operational_alert_trackings"("assigned_user_id");
CREATE INDEX "operational_alert_trackings_last_detected_at_idx"
  ON "operational_alert_trackings"("last_detected_at");
CREATE INDEX "operational_alert_trackings_status_last_detected_at_idx"
  ON "operational_alert_trackings"("status", "last_detected_at");
CREATE INDEX "operational_alert_notes_alert_tracking_id_idx"
  ON "operational_alert_notes"("alert_tracking_id");
CREATE INDEX "operational_alert_notes_author_user_id_idx"
  ON "operational_alert_notes"("author_user_id");

ALTER TABLE "operational_alert_trackings"
  ADD CONSTRAINT "operational_alert_trackings_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_alert_trackings"
  ADD CONSTRAINT "operational_alert_trackings_assigned_user_id_fkey"
  FOREIGN KEY ("assigned_user_id") REFERENCES "auth_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_alert_trackings"
  ADD CONSTRAINT "operational_alert_trackings_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "auth_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_alert_notes"
  ADD CONSTRAINT "operational_alert_notes_alert_tracking_id_fkey"
  FOREIGN KEY ("alert_tracking_id") REFERENCES "operational_alert_trackings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_alert_notes"
  ADD CONSTRAINT "operational_alert_notes_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "auth_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
