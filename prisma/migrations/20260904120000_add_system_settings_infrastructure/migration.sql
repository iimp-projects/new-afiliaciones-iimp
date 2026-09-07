ALTER TYPE "ConfigDataType" ADD VALUE IF NOT EXISTS 'DATETIME';
ALTER TYPE "ConfigDataType" ADD VALUE IF NOT EXISTS 'MONEY';
ALTER TYPE "ConfigDataType" ADD VALUE IF NOT EXISTS 'URL';

CREATE TABLE "sys_system_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "dataType" "ConfigDataType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sys_system_setting_values" (
    "id" SERIAL NOT NULL,
    "setting_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_system_setting_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sys_system_settings_key_key" ON "sys_system_settings"("key");
CREATE INDEX "sys_system_settings_category_idx" ON "sys_system_settings"("category");
CREATE INDEX "sys_system_setting_values_setting_id_starts_at_idx" ON "sys_system_setting_values"("setting_id", "starts_at");
CREATE INDEX "sys_system_setting_values_setting_id_is_active_starts_at_idx" ON "sys_system_setting_values"("setting_id", "is_active", "starts_at");
CREATE INDEX "sys_system_setting_values_updated_by_id_idx" ON "sys_system_setting_values"("updated_by_id");

ALTER TABLE "sys_system_setting_values"
ADD CONSTRAINT "sys_system_setting_values_setting_id_fkey"
FOREIGN KEY ("setting_id") REFERENCES "sys_system_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sys_system_setting_values"
ADD CONSTRAINT "sys_system_setting_values_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
